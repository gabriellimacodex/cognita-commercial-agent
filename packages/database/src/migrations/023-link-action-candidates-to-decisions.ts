import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`alter table commercial_decisions add column action_candidate_id uuid`.execute(
    database,
  );
  await sql`
    alter table commercial_decisions
      add constraint commercial_decisions_action_candidate_same_organization
      foreign key (organization_id, action_candidate_id)
      references commercial_action_candidates(organization_id, id)
  `.execute(database);
  await sql`
    create unique index commercial_decisions_action_candidate_once
      on commercial_decisions (action_candidate_id)
      where action_candidate_id is not null
  `.execute(database);

  await sql`
    create function validate_commercial_decision_action_candidate()
    returns trigger
    language plpgsql
    as $$
    declare candidate commercial_action_candidates%rowtype;
    begin
      if new.action_candidate_id is null then
        return new;
      end if;
      select * into candidate
        from commercial_action_candidates
        where organization_id = new.organization_id
          and id = new.action_candidate_id;
      if not found
        or candidate.lead_id <> new.lead_id
        or candidate.opportunity_id is distinct from new.opportunity_id
        or candidate.requested_action <> new.requested_action then
        raise exception 'commercial Decision and Action Candidate provenance mismatch'
          using errcode = '23514';
      end if;
      return new;
    end
    $$
  `.execute(database);
  await sql`
    create trigger commercial_decisions_validate_action_candidate
      before insert or update of action_candidate_id on commercial_decisions
      for each row execute function validate_commercial_decision_action_candidate()
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop trigger commercial_decisions_validate_action_candidate on commercial_decisions`.execute(
    database,
  );
  await sql`drop function validate_commercial_decision_action_candidate()`.execute(
    database,
  );
  await sql`drop index commercial_decisions_action_candidate_once`.execute(
    database,
  );
  await sql`
    alter table commercial_decisions
      drop constraint commercial_decisions_action_candidate_same_organization,
      drop column action_candidate_id
  `.execute(database);
}
