import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create unique index lead_assignments_one_active_per_lead
      on lead_assignments (organization_id, lead_id)
      where ended_at is null
  `.execute(database);
  await sql`
    create index commercial_events_timeline
      on commercial_events (organization_id, lead_id, recorded_at, id)
  `.execute(database);
  await sql`
    create index messages_conversation_order
      on messages (organization_id, conversation_id, sequence)
  `.execute(database);
  await sql`
    alter table commercial_commands
      add constraint commercial_commands_event_reference
      foreign key (organization_id, event_id)
      references commercial_events(organization_id, id)
  `.execute(database);
  await sql`
    create function reject_commercial_immutable_mutation()
    returns trigger
    language plpgsql
    as $$
    begin
      raise exception '% is append-only', tg_table_name using errcode = '55000';
    end;
    $$
  `.execute(database);
  await sql`
    create trigger messages_immutable
      before update or delete on messages
      for each row execute function reject_commercial_immutable_mutation()
  `.execute(database);
  await sql`
    create trigger commercial_events_immutable
      before update or delete on commercial_events
      for each row execute function reject_commercial_immutable_mutation()
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop trigger commercial_events_immutable on commercial_events`.execute(
    database,
  );
  await sql`drop trigger messages_immutable on messages`.execute(database);
  await sql`drop function reject_commercial_immutable_mutation()`.execute(
    database,
  );
  await sql`
    alter table commercial_commands
      drop constraint commercial_commands_event_reference
  `.execute(database);
  await sql`drop index messages_conversation_order`.execute(database);
  await sql`drop index commercial_events_timeline`.execute(database);
  await sql`drop index lead_assignments_one_active_per_lead`.execute(database);
}
