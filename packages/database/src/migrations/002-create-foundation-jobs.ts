import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table foundation_jobs (
      id uuid primary key,
      idempotency_key varchar(255) not null,
      request_hash char(64) not null,
      input jsonb not null,
      status varchar(16) not null default 'pending',
      publish_attempts integer not null default 0,
      process_attempts integer not null default 0,
      next_publish_at timestamptz not null default now(),
      next_process_at timestamptz,
      process_lease_expires_at timestamptz,
      last_error_code varchar(64),
      last_error_message text,
      result_algorithm varchar(16),
      result_digest char(64),
      result_input_bytes integer,
      queued_at timestamptz,
      processing_started_at timestamptz,
      completed_at timestamptz,
      failed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint foundation_jobs_idempotency_key_unique unique (idempotency_key),
      constraint foundation_jobs_idempotency_key_not_blank
        check (length(btrim(idempotency_key)) > 0),
      constraint foundation_jobs_request_hash_format
        check (request_hash ~ '^[0-9a-f]{64}$'),
      constraint foundation_jobs_status_valid
        check (status in ('pending', 'queued', 'processing', 'completed', 'failed')),
      constraint foundation_jobs_attempts_nonnegative
        check (publish_attempts >= 0 and process_attempts >= 0),
      constraint foundation_jobs_result_bytes_nonnegative
        check (result_input_bytes is null or result_input_bytes >= 0),
      constraint foundation_jobs_completed_has_result
        check (
          status <> 'completed'
          or (
            result_algorithm = 'sha256'
            and result_digest ~ '^[0-9a-f]{64}$'
            and result_input_bytes is not null
            and completed_at is not null
          )
        ),
      constraint foundation_jobs_failed_has_timestamp
        check (status <> 'failed' or failed_at is not null)
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table foundation_jobs`.execute(database);
}
