import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table leads (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      contact_id uuid not null,
      company_id uuid,
      source varchar(80) not null,
      status varchar(16) not null default 'open',
      external_namespace varchar(160),
      external_id varchar(255),
      external_hash char(64),
      external_hash_version integer,
      closed_at timestamptz,
      converted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint leads_organization_identity_unique unique (organization_id, id),
      constraint leads_organization_contact_identity_unique
        unique (organization_id, id, contact_id),
      constraint leads_contact_same_organization
        foreign key (organization_id, contact_id)
        references contacts(organization_id, id),
      constraint leads_company_same_organization
        foreign key (organization_id, company_id)
        references companies(organization_id, id),
      constraint leads_external_identity_unique
        unique (organization_id, external_namespace, source, external_id),
      constraint leads_source_not_blank check (length(btrim(source)) > 0),
      constraint leads_status_valid check (status in ('open', 'converted', 'closed')),
      constraint leads_external_identity_complete check (
        (external_namespace is null and external_id is null and external_hash is null and external_hash_version is null)
        or
        (external_namespace is not null and external_id is not null and external_hash ~ '^[0-9a-f]{64}$' and external_hash_version = 1)
      ),
      constraint leads_terminal_timestamp check (
        (status = 'open' and closed_at is null and converted_at is null)
        or (status = 'closed' and closed_at is not null and converted_at is null)
        or (status = 'converted' and converted_at is not null and closed_at is null)
      )
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table leads`.execute(database);
}
