import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_commands (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      command_type varchar(80) not null,
      idempotency_key varchar(255) not null,
      request_hash char(64) not null,
      status varchar(16) not null,
      target_type varchar(40) not null,
      target_id uuid,
      event_id uuid,
      result_code varchar(80) not null,
      result_http_status integer not null,
      result_schema_version integer not null default 1,
      created_at timestamptz not null default now(),
      completed_at timestamptz,
      constraint commercial_commands_identity_unique
        unique (organization_id, command_type, idempotency_key),
      constraint commercial_commands_request_hash_format
        check (request_hash ~ '^[0-9a-f]{64}$'),
      constraint commercial_commands_status_valid
        check (status in ('in_progress', 'completed')),
      constraint commercial_commands_completed_receipt
        check (status <> 'completed' or completed_at is not null),
      constraint commercial_commands_http_status_valid
        check (result_http_status between 100 and 599),
      constraint commercial_commands_schema_version_positive
        check (result_schema_version > 0),
      constraint commercial_commands_strings_not_blank
        check (
          length(btrim(command_type)) > 0
          and length(btrim(idempotency_key)) > 0
          and length(btrim(target_type)) > 0
          and length(btrim(result_code)) > 0
        )
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table commercial_commands`.execute(database);
}
