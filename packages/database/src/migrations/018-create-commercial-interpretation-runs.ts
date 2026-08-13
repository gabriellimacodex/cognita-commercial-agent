import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`alter table conversations add constraint conversations_organization_lead_identity_unique unique (organization_id, lead_id, id)`.execute(
    database,
  );
  await sql`alter table messages add constraint messages_organization_conversation_identity_unique unique (organization_id, conversation_id, id)`.execute(
    database,
  );
  await sql`
    create table commercial_interpretation_runs (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      conversation_id uuid not null,
      message_id uuid not null,
      status varchar(16) not null default 'running',
      idempotency_key varchar(255) not null,
      request_hash char(64) not null,
      provider_id varchar(40) not null,
      model_id varchar(80) not null,
      returned_model_id varchar(80),
      instruction_key varchar(120) not null,
      instruction_version varchar(32) not null,
      instruction_digest char(64) not null,
      output_schema_version integer not null,
      output_schema_digest char(64) not null,
      invocation_config jsonb not null,
      provider_request_id varchar(255),
      duration_ms integer,
      input_tokens integer,
      output_tokens integer,
      output_digest char(64),
      failure_code varchar(64),
      reprocesses_run_id uuid,
      started_at timestamptz not null default now(),
      completed_at timestamptz,
      failed_at timestamptz,
      constraint interpretation_runs_organization_identity_unique unique (organization_id, id),
      constraint interpretation_runs_scope_identity_unique unique (organization_id, lead_id, message_id, id),
      constraint interpretation_runs_idempotency_unique unique (organization_id, idempotency_key),
      constraint interpretation_runs_lead_same_organization
        foreign key (organization_id, lead_id) references leads(organization_id, id),
      constraint interpretation_runs_conversation_same_lead
        foreign key (organization_id, lead_id, conversation_id)
        references conversations(organization_id, lead_id, id),
      constraint interpretation_runs_message_same_conversation
        foreign key (organization_id, conversation_id, message_id)
        references messages(organization_id, conversation_id, id),
      constraint interpretation_runs_reprocessing_same_organization
        foreign key (organization_id, reprocesses_run_id)
        references commercial_interpretation_runs(organization_id, id),
      constraint interpretation_runs_status_valid
        check (status in ('running', 'completed', 'failed')),
      constraint interpretation_runs_terminal_shape check (
        (status = 'running' and returned_model_id is null and completed_at is null and failed_at is null and failure_code is null)
        or (status = 'completed' and returned_model_id = 'gpt-5.6-terra' and completed_at is not null and failed_at is null and failure_code is null)
        or (status = 'failed' and returned_model_id is null and completed_at is null and failed_at is not null and failure_code is not null)
      ),
      constraint interpretation_runs_baseline_valid check (
        provider_id = 'openai'
        and model_id = 'gpt-5.6-terra'
        and output_schema_version = 1
      ),
      constraint interpretation_runs_metrics_nonnegative check (
        (duration_ms is null or duration_ms >= 0)
        and (input_tokens is null or input_tokens >= 0)
        and (output_tokens is null or output_tokens >= 0)
      ),
      constraint interpretation_runs_hashes_valid check (
        request_hash ~ '^[0-9a-f]{64}$'
        and instruction_digest ~ '^[0-9a-f]{64}$'
        and output_schema_digest ~ '^[0-9a-f]{64}$'
        and (output_digest is null or output_digest ~ '^[0-9a-f]{64}$')
      )
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table commercial_interpretation_runs`.execute(database);
  await sql`alter table messages drop constraint messages_organization_conversation_identity_unique`.execute(
    database,
  );
  await sql`alter table conversations drop constraint conversations_organization_lead_identity_unique`.execute(
    database,
  );
}
