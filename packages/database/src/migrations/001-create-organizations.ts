import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table organizations (
      id uuid primary key,
      name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint organizations_name_not_blank check (length(btrim(name)) > 0)
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table organizations`.execute(database);
}
