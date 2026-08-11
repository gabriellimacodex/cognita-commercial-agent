import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table companies (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      name text not null,
      normalized_domain text,
      cnpj_digits char(14),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint companies_organization_identity_unique unique (organization_id, id),
      constraint companies_cnpj_unique unique (organization_id, cnpj_digits),
      constraint companies_name_not_blank check (length(btrim(name)) > 0),
      constraint companies_domain_not_blank
        check (normalized_domain is null or length(btrim(normalized_domain)) > 0),
      constraint companies_cnpj_format
        check (cnpj_digits is null or cnpj_digits ~ '^[0-9]{14}$')
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table companies`.execute(database);
}
