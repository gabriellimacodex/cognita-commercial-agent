import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_decision_facts (
      organization_id uuid not null,
      decision_id uuid not null,
      fact_id uuid not null,
      fact_key varchar(80) not null,
      created_at timestamptz not null default now(),
      primary key (decision_id, fact_id),
      constraint commercial_decision_facts_decision_same_organization
        foreign key (organization_id, decision_id)
        references commercial_decisions(organization_id, id),
      constraint commercial_decision_facts_fact_same_organization
        foreign key (organization_id, fact_id)
        references commercial_facts(organization_id, id),
      constraint commercial_decision_facts_key_not_blank
        check (length(btrim(fact_key)) > 0)
    )
  `.execute(database);

  await sql`
    create function validate_commercial_decision_fact_scope()
    returns trigger
    language plpgsql
    as $$
    begin
      if not exists (
        select 1
        from commercial_decisions decision
        join commercial_facts fact
          on fact.organization_id = decision.organization_id
          and fact.lead_id = decision.lead_id
        where decision.organization_id = new.organization_id
          and decision.id = new.decision_id
          and fact.id = new.fact_id
          and fact.fact_key = new.fact_key
      ) then
        raise exception 'Decision Fact must share Organization, Lead and key';
      end if;
      return new;
    end;
    $$
  `.execute(database);

  await sql`
    create trigger commercial_decision_fact_scope_valid
      before insert on commercial_decision_facts
      for each row execute function validate_commercial_decision_fact_scope()
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`
    drop trigger commercial_decision_fact_scope_valid
      on commercial_decision_facts
  `.execute(database);
  await sql`drop function validate_commercial_decision_fact_scope()`.execute(
    database,
  );
  await sql`drop table commercial_decision_facts`.execute(database);
}
