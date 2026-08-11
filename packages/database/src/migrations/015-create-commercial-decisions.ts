import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    alter table opportunities
      add constraint opportunities_organization_lead_identity_unique
      unique (organization_id, lead_id, id)
  `.execute(database);

  await sql`
    create table commercial_decisions (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      opportunity_id uuid,
      decision_type varchar(40) not null,
      requested_action varchar(80) not null,
      authority_type varchar(32) not null,
      authority_ref varchar(160) not null,
      executor_ref varchar(160) not null,
      policy_key varchar(80) not null,
      policy_version varchar(32) not null,
      policy_digest char(64) not null,
      decision_schema_version integer not null,
      input_fingerprint char(64) not null,
      input_snapshot jsonb not null,
      outcome varchar(32) not null,
      eligible_actions jsonb not null,
      blocked_actions jsonb not null,
      missing_requirements jsonb not null,
      required_evidence jsonb not null,
      reason_codes jsonb not null,
      escalation_required boolean not null,
      human_reason_code varchar(80),
      human_evidence_type varchar(32),
      human_evidence_ref varchar(255),
      recorded_at timestamptz not null default now(),
      constraint commercial_decisions_organization_identity_unique unique (organization_id, id),
      constraint commercial_decisions_lead_same_organization
        foreign key (organization_id, lead_id)
        references leads(organization_id, id),
      constraint commercial_decisions_opportunity_same_lead
        foreign key (organization_id, lead_id, opportunity_id)
        references opportunities(organization_id, lead_id, id),
      constraint commercial_decisions_authority_valid
        check (authority_type in ('policy', 'declared_human')),
      constraint commercial_decisions_requested_action_valid check (
        requested_action in (
          'create_opportunity', 'transition_to_discovery',
          'transition_to_qualified', 'transition_to_proposal',
          'transition_to_negotiation', 'transition_to_nurture',
          'transition_to_won', 'transition_to_lost',
          'transition_to_disqualified'
        )
      ),
      constraint commercial_decisions_subject_shape_valid check (
        (
          requested_action = 'create_opportunity'
          and opportunity_id is null
          and decision_type = 'opportunity_eligibility'
          and policy_key = 'opportunity-eligibility'
        ) or (
          requested_action <> 'create_opportunity'
          and opportunity_id is not null
          and decision_type = 'commercial_state_transition'
          and policy_key = 'commercial-state-gates'
        )
      ),
      constraint commercial_decisions_policy_authority_ref_valid check (
        authority_type <> 'policy'
        or authority_ref = policy_key || '@' || policy_version
      ),
      constraint commercial_decisions_outcome_valid
        check (outcome in ('allow', 'block', 'require_information', 'require_human_review')),
      constraint commercial_decisions_schema_version_positive check (decision_schema_version > 0),
      constraint commercial_decisions_hashes_valid check (
        policy_digest ~ '^[0-9a-f]{64}$'
        and input_fingerprint ~ '^[0-9a-f]{64}$'
      ),
      constraint commercial_decisions_json_shapes check (
        jsonb_typeof(input_snapshot) = 'object'
        and jsonb_typeof(eligible_actions) = 'array'
        and jsonb_typeof(blocked_actions) = 'array'
        and jsonb_typeof(missing_requirements) = 'array'
        and jsonb_typeof(required_evidence) = 'array'
        and jsonb_typeof(reason_codes) = 'array'
      ),
      constraint commercial_decisions_authority_evidence_complete check (
        (
          authority_type = 'policy'
          and human_reason_code is null
          and human_evidence_type is null
          and human_evidence_ref is null
        ) or (
          authority_type = 'declared_human'
          and human_reason_code is not null
          and length(btrim(human_reason_code)) > 0
          and human_evidence_type is not null
          and human_evidence_ref is not null
          and human_evidence_type in ('message', 'commercial_event', 'human_attestation')
          and length(btrim(human_evidence_ref)) > 0
        )
      ),
      constraint commercial_decisions_human_reason_valid check (
        authority_type = 'policy'
        or (
          requested_action = 'create_opportunity'
          and human_reason_code in (
            'conversion_measurement_gap', 'non_private_profile_requires_review',
            'sales_process_requires_review', 'seller_count_requires_review',
            'commercial_owner_requires_review', 'lead_volume_requires_review',
            'average_ticket_requires_review', 'roi_window_requires_review'
          )
        )
        or (
          requested_action = 'transition_to_qualified'
          and human_reason_code = 'human_qualification_confirmed'
        )
        or (
          requested_action = 'transition_to_proposal'
          and human_reason_code = 'proposal_authorized'
        )
        or (
          requested_action = 'transition_to_negotiation'
          and human_reason_code = 'negotiation_started'
        )
        or (
          requested_action = 'transition_to_nurture'
          and human_reason_code in (
            'nurture_timing_window_pending', 'nurture_budget_cycle_pending',
            'nurture_decision_process_pending',
            'nurture_operational_capacity_pending', 'nurture_initiative_paused'
          )
        )
        or (
          requested_action = 'transition_to_won'
          and human_reason_code = 'commercial_agreement_confirmed'
        )
        or (
          requested_action = 'transition_to_lost'
          and human_reason_code in (
            'customer_declined', 'competitor_selected',
            'commercial_terms_not_accepted', 'budget_lost_after_opportunity',
            'initiative_cancelled', 'other_human_confirmed'
          )
        )
        or (
          requested_action = 'transition_to_disqualified'
          and human_reason_code in ('crm_not_used', 'no_sellers', 'no_recurring_inbound')
        )
      ),
      constraint commercial_decisions_strings_not_blank check (
        length(btrim(decision_type)) > 0
        and length(btrim(requested_action)) > 0
        and length(btrim(authority_ref)) > 0
        and length(btrim(executor_ref)) > 0
        and length(btrim(policy_key)) > 0
        and length(btrim(policy_version)) > 0
      )
    )
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop table commercial_decisions`.execute(database);
  await sql`
    alter table opportunities
      drop constraint opportunities_organization_lead_identity_unique
  `.execute(database);
}
