import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_candidate_resolutions (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      candidate_id uuid not null,
      resolution_type varchar(16) not null,
      confirmation_mode varchar(16),
      rejection_reason_code varchar(64),
      authority_type varchar(32) not null,
      authority_ref varchar(160) not null,
      executor_ref varchar(160) not null,
      commercial_fact_id uuid,
      resolved_at timestamptz not null default now(),
      constraint candidate_resolutions_candidate_unique unique (candidate_id),
      constraint candidate_resolutions_candidate_same_organization
        foreign key (organization_id, candidate_id)
        references commercial_fact_candidates(organization_id, id),
      constraint candidate_resolutions_fact_same_organization
        foreign key (organization_id, commercial_fact_id)
        references commercial_facts(organization_id, id),
      constraint candidate_resolutions_authority_valid
        check (authority_type = 'declared_human'),
      constraint candidate_resolutions_shape_valid check (
        (resolution_type = 'confirmed' and confirmation_mode in ('assert', 'correct')
          and rejection_reason_code is null and commercial_fact_id is not null)
        or (resolution_type = 'rejected' and confirmation_mode is null
          and rejection_reason_code in (
            'incorrect_extraction', 'insufficient_evidence', 'ambiguous_statement',
            'outdated_information', 'duplicate_candidate', 'not_applicable'
          ) and commercial_fact_id is null)
      )
    )
  `.execute(database);

  await sql`create index interpretation_runs_message_history
    on commercial_interpretation_runs (organization_id, message_id, started_at, id)`.execute(
    database,
  );
  await sql`create index fact_candidates_run_history
    on commercial_fact_candidates (organization_id, interpretation_run_id, created_at, id)`.execute(
    database,
  );

  await sql`
    create function validate_interpretation_run_transition()
    returns trigger
    language plpgsql
    as $$
    begin
      if old.status <> 'running' or new.status not in ('completed', 'failed') then
        raise exception 'interpretation run terminal state cannot regress';
      end if;
      if old.id is distinct from new.id
        or old.organization_id is distinct from new.organization_id
        or old.lead_id is distinct from new.lead_id
        or old.conversation_id is distinct from new.conversation_id
        or old.message_id is distinct from new.message_id
        or old.idempotency_key is distinct from new.idempotency_key
        or old.request_hash is distinct from new.request_hash
        or old.provider_id is distinct from new.provider_id
        or old.model_id is distinct from new.model_id
        or old.instruction_key is distinct from new.instruction_key
        or old.instruction_version is distinct from new.instruction_version
        or old.instruction_digest is distinct from new.instruction_digest
        or old.output_schema_version is distinct from new.output_schema_version
        or old.output_schema_digest is distinct from new.output_schema_digest
        or old.invocation_config is distinct from new.invocation_config
        or old.reprocesses_run_id is distinct from new.reprocesses_run_id
        or old.started_at is distinct from new.started_at
      then
        raise exception 'interpretation run identity and baseline are immutable';
      end if;
      return new;
    end;
    $$
  `.execute(database);
  await sql`
    create trigger commercial_interpretation_runs_delete_immutable
      before delete on commercial_interpretation_runs
      for each row execute function reject_commercial_immutable_mutation()
  `.execute(database);
  await sql`
    create trigger commercial_interpretation_runs_transition_valid
      before update on commercial_interpretation_runs
      for each row execute function validate_interpretation_run_transition()
  `.execute(database);

  for (const table of [
    "commercial_fact_candidates",
    "commercial_evidence_spans",
    "commercial_candidate_resolutions",
  ]) {
    await sql
      .raw(
        `
      create trigger ${table}_immutable
        before update or delete on ${table}
        for each row execute function reject_commercial_immutable_mutation()
    `,
      )
      .execute(database);
  }
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop trigger if exists commercial_interpretation_runs_delete_immutable on commercial_interpretation_runs`.execute(
    database,
  );
  await sql`drop trigger commercial_interpretation_runs_transition_valid on commercial_interpretation_runs`.execute(
    database,
  );
  await sql`drop function validate_interpretation_run_transition()`.execute(
    database,
  );
  for (const table of [
    "commercial_candidate_resolutions",
    "commercial_evidence_spans",
    "commercial_fact_candidates",
  ]) {
    await sql
      .raw(`drop trigger ${table}_immutable on ${table}`)
      .execute(database);
  }
  await sql`drop index fact_candidates_run_history`.execute(database);
  await sql`drop index interpretation_runs_message_history`.execute(database);
  await sql`drop table commercial_candidate_resolutions`.execute(database);
}
