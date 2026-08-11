import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table conversations (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      contact_id uuid not null,
      channel varchar(80) not null,
      external_namespace varchar(160) not null,
      external_thread_id varchar(255),
      external_hash char(64),
      external_hash_version integer,
      status varchar(16) not null default 'open',
      next_message_sequence integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      closed_at timestamptz,
      constraint conversations_organization_identity_unique unique (organization_id, id),
      constraint conversations_lead_contact_same_organization
        foreign key (organization_id, lead_id, contact_id)
        references leads(organization_id, id, contact_id),
      constraint conversations_external_identity_unique
        unique (organization_id, external_namespace, channel, external_thread_id),
      constraint conversations_strings_not_blank check (
        length(btrim(channel)) > 0 and length(btrim(external_namespace)) > 0
      ),
      constraint conversations_status_valid check (status in ('open', 'closed')),
      constraint conversations_sequence_positive check (next_message_sequence > 0),
      constraint conversations_external_identity_complete check (
        (external_thread_id is null and external_hash is null and external_hash_version is null)
        or
        (external_thread_id is not null and external_hash ~ '^[0-9a-f]{64}$' and external_hash_version = 1)
      ),
      constraint conversations_closed_timestamp check (
        (status = 'open' and closed_at is null)
        or (status = 'closed' and closed_at is not null)
      )
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table conversations`.execute(database);
}
