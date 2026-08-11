import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    alter table commercial_commands
      add constraint commercial_commands_organization_identity_unique
      unique (organization_id, id)
  `.execute(database);

  await sql`
    create table commercial_decision_applications (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      decision_id uuid not null,
      command_id uuid not null,
      target_type varchar(40) not null,
      target_id uuid not null,
      applied_at timestamptz not null default now(),
      constraint commercial_decision_applications_decision_once unique (decision_id),
      constraint commercial_decision_applications_command_once unique (command_id),
      constraint commercial_decision_applications_decision_same_organization
        foreign key (organization_id, decision_id)
        references commercial_decisions(organization_id, id),
      constraint commercial_decision_applications_command_same_organization
        foreign key (organization_id, command_id)
        references commercial_commands(organization_id, id),
      constraint commercial_decision_applications_strings_not_blank
        check (length(btrim(target_type)) > 0)
    )
  `.execute(database);

  await sql`
    create index commercial_facts_active_snapshot
      on commercial_facts (organization_id, lead_id, fact_key, fact_schema_version, recorded_at, id)
  `.execute(database);
  await sql`
    create index commercial_decisions_lead_history
      on commercial_decisions (organization_id, lead_id, recorded_at, id)
  `.execute(database);

  for (const table of [
    "commercial_facts",
    "commercial_fact_corrections",
    "commercial_decisions",
    "commercial_decision_facts",
    "commercial_decision_applications",
  ]) {
    await sql
      .raw(
        `
      create trigger ${table}_immutable
        before update or delete on ${table}
        for each row execute function reject_commercial_immutable_mutation()
    `,
      )
      .execute(database);
  }
}

export async function down(database: Kysely<unknown>): Promise<void> {
  for (const table of [
    "commercial_decision_applications",
    "commercial_decision_facts",
    "commercial_decisions",
    "commercial_fact_corrections",
    "commercial_facts",
  ]) {
    await sql
      .raw(`drop trigger ${table}_immutable on ${table}`)
      .execute(database);
  }
  await sql`drop index commercial_decisions_lead_history`.execute(database);
  await sql`drop index commercial_facts_active_snapshot`.execute(database);
  await sql`drop table commercial_decision_applications`.execute(database);
  await sql`
    alter table commercial_commands
      drop constraint commercial_commands_organization_identity_unique
  `.execute(database);
}
