import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table contacts (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      company_id uuid,
      name text not null,
      normalized_email text,
      normalized_phone text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint contacts_organization_identity_unique unique (organization_id, id),
      constraint contacts_company_same_organization
        foreign key (organization_id, company_id)
        references companies(organization_id, id),
      constraint contacts_name_not_blank check (length(btrim(name)) > 0),
      constraint contacts_email_not_blank
        check (normalized_email is null or length(btrim(normalized_email)) > 0),
      constraint contacts_phone_not_blank
        check (normalized_phone is null or length(btrim(normalized_phone)) > 0)
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table contacts`.execute(database);
}
