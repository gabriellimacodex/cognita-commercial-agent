import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table messages (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      conversation_id uuid not null,
      channel varchar(80) not null,
      sequence integer not null,
      direction varchar(16) not null,
      author_type varchar(16) not null,
      content_type varchar(16) not null,
      body text not null,
      external_namespace varchar(160),
      external_id varchar(255),
      external_hash char(64),
      external_hash_version integer,
      occurred_at timestamptz not null,
      recorded_at timestamptz not null default now(),
      constraint messages_organization_identity_unique unique (organization_id, id),
      constraint messages_conversation_sequence_unique unique (conversation_id, sequence),
      constraint messages_external_identity_unique
        unique (organization_id, external_namespace, channel, external_id),
      constraint messages_conversation_same_organization
        foreign key (organization_id, conversation_id)
        references conversations(organization_id, id),
      constraint messages_sequence_positive check (sequence > 0),
      constraint messages_direction_inbound check (direction = 'inbound'),
      constraint messages_author_contact check (author_type = 'contact'),
      constraint messages_content_text check (content_type = 'text'),
      constraint messages_body_length check (length(body) between 1 and 10000),
      constraint messages_channel_not_blank check (length(btrim(channel)) > 0),
      constraint messages_external_identity_complete check (
        (external_namespace is null and external_id is null and external_hash is null and external_hash_version is null)
        or
        (external_namespace is not null and external_id is not null and external_hash ~ '^[0-9a-f]{64}$' and external_hash_version = 1)
      )
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table messages`.execute(database);
}
