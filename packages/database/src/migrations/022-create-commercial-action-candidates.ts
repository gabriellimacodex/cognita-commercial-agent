import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_action_candidates (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      opportunity_id uuid,
      action_plan_id uuid not null,
      candidate_type varchar(40) not null,
      requested_action varchar(80) not null,
      requirement_id varchar(80),
      required_capability_key varchar(80) not null,
      decision_basis_fingerprint char(64) not null,
      rationale_codes jsonb not null,
      decision_reason_codes jsonb not null,
      recorded_at timestamptz not null default now(),
      constraint action_candidates_organization_identity_unique unique (organization_id, id),
      constraint action_candidates_scope_identity_unique unique (organization_id, lead_id, id),
      constraint action_candidates_one_per_plan unique (action_plan_id),
      constraint action_candidates_plan_same_scope
        foreign key (organization_id, lead_id, action_plan_id)
        references commercial_action_plans(organization_id, lead_id, id),
      constraint action_candidates_opportunity_same_lead
        foreign key (organization_id, lead_id, opportunity_id)
        references opportunities(organization_id, lead_id, id),
      constraint action_candidates_action_valid check (
        requested_action in (
          'create_opportunity', 'transition_to_discovery', 'transition_to_qualified'
        )
      ),
      constraint action_candidates_subject_shape_valid check (
        (requested_action = 'create_opportunity' and opportunity_id is null)
        or (requested_action <> 'create_opportunity' and opportunity_id is not null)
      ),
      constraint action_candidates_semantic_shape_valid check (
        (
          candidate_type = 'collect_requirement'
          and requirement_id in (
            'contact_has_reachable_channel', 'company_ownership_type_known',
            'sales_process_known', 'crm_usage_known', 'sales_capacity_known',
            'commercial_owner_known', 'recurring_inbound_known', 'lead_volume_known',
            'average_ticket_known', 'conversion_measurement_known',
            'roi_measurement_known', 'pain_confirmed_with_evidence',
            'pain_recurring_with_evidence', 'pain_measurable_with_evidence',
            'decision_maker_access_known', 'budget_known',
            'operational_capacity_known', 'timing_known',
            'nurture_revisit_date_known', 'nurture_return_condition_known'
          )
          and required_capability_key = 'collect_commercial_requirement_v1'
        ) or (
          candidate_type = 'request_human_review'
          and requirement_id is null
          and required_capability_key in (
            'resolve_commercial_fact_conflict_v1', 'review_commercial_exception_v1'
          )
        ) or (
          candidate_type = 'submit_material_action'
          and requirement_id is null
          and required_capability_key = 'submit_commercial_decision_v1'
        )
      ),
      constraint action_candidates_hash_valid
        check (decision_basis_fingerprint ~ '^[0-9a-f]{64}$'),
      constraint action_candidates_json_shapes check (
        jsonb_typeof(rationale_codes) = 'array'
        and jsonb_typeof(decision_reason_codes) = 'array'
        and rationale_codes <@ '["missing_requirement_selected", "fact_conflict_requires_resolution", "human_review_required", "material_action_ready"]'::jsonb
      )
    )
  `.execute(database);

  await sql`
    create function validate_commercial_action_candidate_plan()
    returns trigger
    language plpgsql
    as $$
    declare source_plan commercial_action_plans%rowtype;
    begin
      select * into source_plan
        from commercial_action_plans
        where organization_id = new.organization_id
          and lead_id = new.lead_id
          and id = new.action_plan_id;
      if not found
        or source_plan.result_type <> 'candidate'
        or source_plan.opportunity_id is distinct from new.opportunity_id
        or source_plan.input_snapshot->>'requestedAction' <> new.requested_action then
        raise exception 'Commercial Action Candidate does not match its source Plan'
          using errcode = '23514';
      end if;
      return new;
    end
    $$
  `.execute(database);

  await sql`
    create trigger commercial_action_candidates_validate_plan
      before insert on commercial_action_candidates
      for each row execute function validate_commercial_action_candidate_plan()
  `.execute(database);

  await sql`
    create trigger commercial_action_candidates_immutable
      before update or delete on commercial_action_candidates
      for each row execute function reject_commercial_immutable_mutation()
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop trigger commercial_action_candidates_validate_plan on commercial_action_candidates`.execute(
    database,
  );
  await sql`drop function validate_commercial_action_candidate_plan()`.execute(
    database,
  );
  await sql`drop trigger commercial_action_candidates_immutable on commercial_action_candidates`.execute(
    database,
  );
  await sql`drop table commercial_action_candidates`.execute(database);
}
