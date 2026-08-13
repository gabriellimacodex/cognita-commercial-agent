import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_fact_candidates (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      interpretation_run_id uuid not null,
      message_id uuid not null,
      fact_key varchar(80) not null,
      fact_schema_version integer not null,
      value_type varchar(20),
      proposed_value jsonb,
      classification varchar(20) not null,
      ambiguity_code varchar(48),
      ambiguity_details jsonb,
      validation_code varchar(64),
      duplicate_of_candidate_id uuid,
      created_at timestamptz not null default now(),
      constraint fact_candidates_organization_identity_unique unique (organization_id, id),
      constraint fact_candidates_scope_identity_unique unique (organization_id, message_id, id),
      constraint fact_candidates_run_same_scope
        foreign key (organization_id, lead_id, message_id, interpretation_run_id)
        references commercial_interpretation_runs(organization_id, lead_id, message_id, id),
      constraint fact_candidates_duplicate_same_organization
        foreign key (organization_id, duplicate_of_candidate_id)
        references commercial_fact_candidates(organization_id, id),
      constraint fact_candidates_classification_valid
        check (classification in ('reviewable', 'ambiguous', 'invalid', 'duplicate')),
      constraint fact_candidates_shape_valid check (
        (classification = 'reviewable' and proposed_value is not null and value_type is not null
          and ambiguity_code is null and ambiguity_details is null
          and validation_code is null and duplicate_of_candidate_id is null)
        or (classification = 'ambiguous' and proposed_value is null and value_type is null
          and ambiguity_code is not null and validation_code is null and duplicate_of_candidate_id is null)
        or (classification = 'invalid' and validation_code is not null and duplicate_of_candidate_id is null)
        or (classification = 'duplicate' and duplicate_of_candidate_id is not null and validation_code is null)
      ),
      constraint fact_candidates_schema_version_supported check (fact_schema_version = 1)
    )
  `.execute(database);

  await sql`
    create table commercial_evidence_spans (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      candidate_id uuid not null,
      message_id uuid not null,
      evidence_type varchar(32) not null,
      start_offset integer not null,
      end_offset integer not null,
      span_digest char(64) not null,
      created_at timestamptz not null default now(),
      constraint evidence_spans_candidate_unique unique (candidate_id),
      constraint evidence_spans_candidate_same_message
        foreign key (organization_id, message_id, candidate_id)
        references commercial_fact_candidates(organization_id, message_id, id),
      constraint evidence_spans_shape_valid check (
        evidence_type = 'message_text_span'
        and start_offset >= 0
        and end_offset > start_offset
        and span_digest ~ '^[0-9a-f]{64}$'
      )
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table commercial_evidence_spans`.execute(database);
  await sql`drop table commercial_fact_candidates`.execute(database);
}
