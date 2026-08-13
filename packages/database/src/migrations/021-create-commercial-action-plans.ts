import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create table commercial_action_plans (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      opportunity_id uuid,
      objective_key varchar(80) not null,
      objective_version varchar(32) not null,
      objective_digest char(64) not null,
      planner_key varchar(80) not null,
      planner_version varchar(32) not null,
      planner_digest char(64) not null,
      action_catalog_key varchar(80) not null,
      action_catalog_version varchar(32) not null,
      action_catalog_digest char(64) not null,
      requirement_priority_key varchar(80) not null,
      requirement_priority_version varchar(32) not null,
      requirement_priority_digest char(64) not null,
      input_fingerprint char(64) not null,
      input_snapshot jsonb not null,
      output_digest char(64) not null,
      result_type varchar(16) not null,
      rationale_codes jsonb not null,
      executor_ref varchar(160) not null,
      recorded_at timestamptz not null default now(),
      constraint action_plans_organization_identity_unique unique (organization_id, id),
      constraint action_plans_scope_identity_unique unique (organization_id, lead_id, id),
      constraint action_plans_lead_same_organization
        foreign key (organization_id, lead_id) references leads(organization_id, id),
      constraint action_plans_opportunity_same_lead
        foreign key (organization_id, lead_id, opportunity_id)
        references opportunities(organization_id, lead_id, id),
      constraint action_plans_semantic_unique
        unique (organization_id, lead_id, planner_key, planner_version, input_fingerprint),
      constraint action_plans_result_valid check (result_type in ('candidate', 'no_action')),
      constraint action_plans_baseline_valid check (
        objective_key = 'progress_commercial_case'
        and objective_version = '1.0.0'
        and planner_key = 'commercial-action-planner'
        and planner_version = '1.0.0'
        and action_catalog_key = 'commercial-planner-actions'
        and action_catalog_version = '1.0.0'
        and requirement_priority_key = 'commercial-requirement-priority'
        and requirement_priority_version = '1.0.0'
      ),
      constraint action_plans_hashes_valid check (
        objective_digest ~ '^[0-9a-f]{64}$'
        and planner_digest ~ '^[0-9a-f]{64}$'
        and action_catalog_digest ~ '^[0-9a-f]{64}$'
        and requirement_priority_digest ~ '^[0-9a-f]{64}$'
        and input_fingerprint ~ '^[0-9a-f]{64}$'
        and output_digest ~ '^[0-9a-f]{64}$'
      ),
      constraint action_plans_json_shapes check (
        jsonb_typeof(input_snapshot) = 'object'
        and jsonb_typeof(rationale_codes) = 'array'
        and rationale_codes <@ '["planner_scope_not_supported", "policy_blocked", "missing_requirement_selected", "fact_conflict_requires_resolution", "human_review_required", "material_action_ready"]'::jsonb
      ),
      constraint action_plans_strings_not_blank check (length(btrim(executor_ref)) > 0)
    )
  `.execute(database);

  await sql`
    create trigger commercial_action_plans_immutable
      before update or delete on commercial_action_plans
      for each row execute function reject_commercial_immutable_mutation()
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop trigger commercial_action_plans_immutable on commercial_action_plans`.execute(
    database,
  );
  await sql`drop table commercial_action_plans`.execute(database);
}
