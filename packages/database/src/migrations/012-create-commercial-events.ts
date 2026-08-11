import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_events (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      subject_type varchar(40) not null,
      subject_id uuid not null,
      lead_id uuid,
      event_type varchar(80) not null,
      event_version integer not null default 1,
      actor_ref varchar(160) not null,
      metadata jsonb not null default '{}'::jsonb,
      occurred_at timestamptz not null default now(),
      recorded_at timestamptz not null default now(),
      constraint commercial_events_organization_identity_unique unique (organization_id, id),
      constraint commercial_events_lead_same_organization
        foreign key (organization_id, lead_id)
        references leads(organization_id, id),
      constraint commercial_events_strings_not_blank check (
        length(btrim(subject_type)) > 0
        and length(btrim(event_type)) > 0
        and length(btrim(actor_ref)) > 0
      ),
      constraint commercial_events_version_positive check (event_version > 0),
      constraint commercial_events_metadata_object
        check (jsonb_typeof(metadata) = 'object')
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table commercial_events`.execute(database);
}
