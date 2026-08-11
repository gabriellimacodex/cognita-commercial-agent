import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_facts (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      fact_key varchar(80) not null,
      fact_schema_version integer not null,
      value_type varchar(20) not null,
      value jsonb not null,
      source_type varchar(32) not null,
      source_ref varchar(255) not null,
      declarer_ref varchar(160) not null,
      authority_type varchar(32),
      authority_ref varchar(160),
      executor_ref varchar(160) not null,
      evidence_type varchar(32),
      evidence_ref varchar(255),
      observed_at timestamptz not null,
      recorded_at timestamptz not null default now(),
      constraint commercial_facts_organization_identity_unique unique (organization_id, id),
      constraint commercial_facts_lead_same_organization
        foreign key (organization_id, lead_id)
        references leads(organization_id, id),
      constraint commercial_facts_schema_version_supported check (fact_schema_version = 1),
      constraint commercial_facts_key_supported check (
        fact_key in (
          'company_ownership_type',
          'has_existing_sales_process',
          'uses_crm',
          'seller_count',
          'commercial_owner_defined',
          'has_recurring_inbound',
          'monthly_lead_volume',
          'average_ticket_brl_cents',
          'measures_conversion',
          'roi_provable_within_90_days',
          'sales_cycle_days',
          'pain_confirmed',
          'pain_recurring',
          'pain_measurable',
          'decision_maker_access_confirmed',
          'budget_confirmed',
          'operational_capacity_confirmed',
          'timing_status',
          'revisit_at',
          'nurture_return_condition'
        )
      ),
      constraint commercial_facts_value_type_valid
        check (value_type in ('boolean', 'integer', 'string', 'timestamp')),
      constraint commercial_facts_source_type_valid
        check (source_type in ('human_declaration', 'domain_record')),
      constraint commercial_facts_authority_valid check (
        (authority_type is null and authority_ref is null)
        or (
          authority_type = 'declared_human'
          and authority_ref is not null
          and length(btrim(authority_ref)) > 0
        )
      ),
      constraint commercial_facts_evidence_complete check (
        (evidence_type is null and evidence_ref is null)
        or (
          evidence_type is not null
          and evidence_ref is not null
          and evidence_type in ('message', 'commercial_event', 'human_attestation')
          and length(btrim(evidence_ref)) > 0
        )
      ),
      constraint commercial_facts_pain_evidence_required check (
        fact_key not in ('pain_confirmed', 'pain_recurring', 'pain_measurable')
        or evidence_type is not null
      ),
      constraint commercial_facts_value_matches_catalog check (
        (
          fact_key in (
            'has_existing_sales_process', 'uses_crm', 'commercial_owner_defined',
            'has_recurring_inbound', 'measures_conversion',
            'roi_provable_within_90_days', 'pain_confirmed', 'pain_recurring',
            'pain_measurable', 'decision_maker_access_confirmed',
            'budget_confirmed', 'operational_capacity_confirmed'
          )
          and value_type = 'boolean'
          and jsonb_typeof(value) = 'boolean'
        )
        or (
          fact_key in (
            'seller_count', 'monthly_lead_volume', 'average_ticket_brl_cents',
            'sales_cycle_days'
          )
          and value_type = 'integer'
          and jsonb_typeof(value) = 'number'
          and (value #>> '{}')::numeric >= 0
          and trunc((value #>> '{}')::numeric) = (value #>> '{}')::numeric
          and (fact_key <> 'sales_cycle_days' or (value #>> '{}')::numeric > 0)
        )
        or (
          fact_key = 'company_ownership_type'
          and value_type = 'string'
          and (value #>> '{}') in ('private', 'public', 'government', 'nonprofit', 'other')
        )
        or (
          fact_key = 'timing_status'
          and value_type = 'string'
          and (value #>> '{}') in ('available_now', 'temporarily_unavailable', 'no_active_timing')
        )
        or (
          fact_key = 'nurture_return_condition'
          and value_type = 'string'
          and (value #>> '{}') in (
            'timing_window_opens', 'budget_cycle_opens',
            'decision_process_resumes', 'operational_capacity_available',
            'initiative_resumes'
          )
        )
        or (
          fact_key = 'revisit_at'
          and value_type = 'timestamp'
          and jsonb_typeof(value) = 'string'
          and (value #>> '{}')::timestamptz > recorded_at
        )
      ),
      constraint commercial_facts_strings_not_blank check (
        length(btrim(fact_key)) > 0
        and length(btrim(source_ref)) > 0
        and length(btrim(declarer_ref)) > 0
        and length(btrim(executor_ref)) > 0
      )
    )
  `.execute(database);

  await sql`
    create table commercial_fact_corrections (
      corrective_fact_id uuid not null,
      corrected_fact_id uuid not null,
      organization_id uuid not null,
      created_at timestamptz not null default now(),
      primary key (corrective_fact_id, corrected_fact_id),
      constraint commercial_fact_corrections_corrected_once unique (corrected_fact_id),
      constraint commercial_fact_corrections_not_self check (corrective_fact_id <> corrected_fact_id),
      constraint commercial_fact_corrections_corrective_same_organization
        foreign key (organization_id, corrective_fact_id)
        references commercial_facts(organization_id, id),
      constraint commercial_fact_corrections_corrected_same_organization
        foreign key (organization_id, corrected_fact_id)
        references commercial_facts(organization_id, id)
    )
  `.execute(database);

  await sql`
    create function validate_commercial_fact_correction_set()
    returns trigger
    language plpgsql
    as $$
    declare
      correction record;
    begin
      for correction in
        select distinct corrective_fact_id
        from new_corrections
      loop
        if not exists (
          select 1
          from commercial_facts corrective
          where corrective.id = correction.corrective_fact_id
            and corrective.authority_type = 'declared_human'
            and corrective.authority_ref is not null
            and corrective.evidence_type is not null
            and corrective.evidence_ref is not null
        ) then
          raise exception 'corrective Fact requires human authority and evidence';
        end if;

        if exists (
          select 1
          from commercial_fact_corrections link
          join commercial_facts corrective on corrective.id = link.corrective_fact_id
          join commercial_facts corrected on corrected.id = link.corrected_fact_id
          where link.corrective_fact_id = correction.corrective_fact_id
            and (
              corrective.organization_id <> corrected.organization_id
              or corrective.lead_id <> corrected.lead_id
              or corrective.fact_key <> corrected.fact_key
              or corrective.fact_schema_version <> corrected.fact_schema_version
            )
        ) then
          raise exception 'corrected Facts must share Organization, Lead, key and schema';
        end if;

        if exists (
          select 1
          from commercial_facts corrective
          join commercial_facts candidate
            on candidate.organization_id = corrective.organization_id
            and candidate.lead_id = corrective.lead_id
            and candidate.fact_key = corrective.fact_key
            and candidate.fact_schema_version = corrective.fact_schema_version
          where corrective.id = correction.corrective_fact_id
            and candidate.id <> corrective.id
            and not exists (
              select 1
              from commercial_fact_corrections replacement
              where replacement.corrected_fact_id = candidate.id
            )
        ) then
          raise exception 'correction must replace the complete active Fact set';
        end if;
      end loop;
      return null;
    end;
    $$
  `.execute(database);

  await sql`
    create trigger commercial_fact_correction_set_valid
      after insert on commercial_fact_corrections
      referencing new table as new_corrections
      for each statement execute function validate_commercial_fact_correction_set()
  `.execute(database);

  await sql`
    create function validate_commercial_corrective_fact_link()
    returns trigger
    language plpgsql
    as $$
    begin
      if new.authority_type = 'declared_human'
        and not exists (
          select 1
          from commercial_fact_corrections correction
          where correction.corrective_fact_id = new.id
        )
      then
        raise exception 'human correction authority requires correction links';
      end if;
      return new;
    end;
    $$
  `.execute(database);

  await sql`
    create constraint trigger commercial_corrective_fact_link_valid
      after insert on commercial_facts
      deferrable initially deferred
      for each row execute function validate_commercial_corrective_fact_link()
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`
    drop trigger commercial_corrective_fact_link_valid
      on commercial_facts
  `.execute(database);
  await sql`drop function validate_commercial_corrective_fact_link()`.execute(
    database,
  );
  await sql`
    drop trigger commercial_fact_correction_set_valid
      on commercial_fact_corrections
  `.execute(database);
  await sql`drop function validate_commercial_fact_correction_set()`.execute(
    database,
  );
  await sql`drop table commercial_fact_corrections`.execute(database);
  await sql`drop table commercial_facts`.execute(database);
}
