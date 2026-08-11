import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table lead_assignments (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      assignee_ref varchar(160) not null,
      assigned_at timestamptz not null default now(),
      ended_at timestamptz,
      constraint lead_assignments_organization_identity_unique unique (organization_id, id),
      constraint lead_assignments_lead_same_organization
        foreign key (organization_id, lead_id)
        references leads(organization_id, id),
      constraint lead_assignments_assignee_not_blank check (length(btrim(assignee_ref)) > 0),
      constraint lead_assignments_end_after_start
        check (ended_at is null or ended_at >= assigned_at)
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table lead_assignments`.execute(database);
}
