import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table opportunities (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      commercial_state varchar(20) not null default 'open',
      last_transition_reason_code varchar(80),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint opportunities_organization_identity_unique unique (organization_id, id),
      constraint opportunities_one_per_lead unique (organization_id, lead_id),
      constraint opportunities_lead_same_organization
        foreign key (organization_id, lead_id)
        references leads(organization_id, id),
      constraint opportunities_state_valid check (
        commercial_state in (
          'open', 'discovery', 'qualified', 'proposal', 'negotiation',
          'nurture', 'won', 'lost', 'disqualified'
        )
      ),
      constraint opportunities_reason_not_blank
        check (last_transition_reason_code is null or length(btrim(last_transition_reason_code)) > 0)
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table opportunities`.execute(database);
}
