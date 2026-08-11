import type {
  CommercialDecisionOutcome,
  CommercialFactKey,
  CommercialFactSnapshot,
  CommercialRequestedAction,
  CreateCommercialDecisionInput,
  Lead,
  Opportunity,
} from "@cognita/schemas";
import {
  commercialHumanReasonCodesByAction,
  isCommercialHumanReasonAllowed,
} from "@cognita/schemas";

import { hashCanonical } from "./commercial-domain.js";

export const commercialReasons = {
  key: "commercial-reasons",
  version: "1.0.0",
  codes: [
    "contact_channel_missing",
    "fact_unknown",
    "fact_conflict",
    "fact_evidence_missing",
    "lead_not_open",
    "opportunity_already_exists",
    "crm_not_used",
    "no_sellers",
    "no_recurring_inbound",
    "conversion_measurement_gap",
    "non_private_profile_requires_review",
    "sales_process_requires_review",
    "seller_count_requires_review",
    "commercial_owner_requires_review",
    "lead_volume_requires_review",
    "average_ticket_requires_review",
    "roi_window_requires_review",
    "long_sales_cycle_priority_signal",
    "pain_not_confirmed",
    "pain_not_recurring",
    "pain_not_measurable",
    "decision_maker_access_not_confirmed",
    "budget_not_confirmed",
    "operational_capacity_not_confirmed",
    "timing_not_available",
    "nurture_revisit_missing",
    "nurture_return_condition_missing",
    "human_authority_required",
    "decision_stale",
    "decision_already_applied",
  ] as const,
} as const;

const commercialTransitions = {
  open: ["discovery", "nurture", "lost", "disqualified"],
  discovery: ["qualified", "nurture", "lost", "disqualified"],
  qualified: ["proposal", "nurture", "lost"],
  proposal: ["negotiation", "won", "nurture", "lost"],
  negotiation: ["won", "nurture", "lost"],
  nurture: ["discovery", "lost", "disqualified"],
  won: [],
  lost: [],
  disqualified: [],
} as const satisfies Readonly<
  Record<
    Opportunity["commercialState"],
    readonly Opportunity["commercialState"][]
  >
>;

const opportunityEligibilityPolicy = {
  key: "opportunity-eligibility",
  version: "1.0.0",
  canonicalizationVersion: 1,
  requestedAction: "create_opportunity",
  precedence: [
    "structural_block",
    "fact_conflict",
    "hard_exclusion",
    "missing_requirement",
    "human_review",
    "allow",
  ],
  gates: [
    "subject_integrity",
    "lead_open",
    "no_existing_opportunity",
    "contact_reachable",
    "facts_consistent",
    "hard_exclusions_clear",
    "standard_fit",
    "pain_evidenced",
    "opportunity_ready",
  ],
  requiredFacts: [
    "company_ownership_type",
    "has_existing_sales_process",
    "uses_crm",
    "seller_count",
    "commercial_owner_defined",
    "has_recurring_inbound",
    "monthly_lead_volume",
    "average_ticket_brl_cents",
    "measures_conversion",
    "roi_provable_within_90_days",
    "pain_confirmed",
    "pain_recurring",
    "pain_measurable",
  ],
  standard: {
    companyOwnershipType: "private",
    hasExistingSalesProcess: true,
    usesCrm: true,
    sellerCount: 3,
    commercialOwnerDefined: true,
    hasRecurringInbound: true,
    monthlyLeadVolume: 500,
    averageTicketBrlCents: 500_000,
    measuresConversion: true,
    roiProvableWithin90Days: true,
    painConfirmed: true,
    painRecurring: true,
    painMeasurable: true,
    salesCycleDays: 45,
  },
  hardExclusions: {
    uses_crm: false,
    seller_count: 0,
    has_recurring_inbound: false,
  },
  reviewFacts: [
    "company_ownership_type",
    "has_existing_sales_process",
    "seller_count",
    "commercial_owner_defined",
    "monthly_lead_volume",
    "average_ticket_brl_cents",
    "measures_conversion",
    "roi_provable_within_90_days",
  ],
  humanReviewReasonCodes: commercialHumanReasonCodesByAction.create_opportunity,
  painFacts: ["pain_confirmed", "pain_recurring", "pain_measurable"],
  reasons: commercialReasons,
} as const;

const commercialStateGatesPolicy = {
  key: "commercial-state-gates",
  version: "1.0.0",
  canonicalizationVersion: 1,
  precedence: opportunityEligibilityPolicy.precedence,
  transitions: commercialTransitions,
  gates: [
    "subject_integrity",
    "structural_transition",
    "facts_consistent",
    "hard_exclusions_clear",
    "pain_evidenced",
    "qualification_complete",
    "human_authority",
    "nurture_eligible",
    "terminal_reason_valid",
  ],
  discoveryFacts: ["pain_confirmed", "pain_recurring", "pain_measurable"],
  discoveryRequiredValue: true,
  qualificationFacts: [
    "decision_maker_access_confirmed",
    "budget_confirmed",
    "operational_capacity_confirmed",
    "timing_status",
  ],
  qualificationRequiredValues: {
    decision_maker_access_confirmed: true,
    budget_confirmed: true,
    operational_capacity_confirmed: true,
    timing_status: "available_now",
  },
  nurture: {
    timingStatus: "temporarily_unavailable",
    facts: ["revisit_at", "nurture_return_condition"],
    hardExclusions: opportunityEligibilityPolicy.hardExclusions,
    fitFacts: opportunityEligibilityPolicy.requiredFacts,
  },
  humanOnly: [
    "transition_to_qualified",
    "transition_to_proposal",
    "transition_to_negotiation",
    "transition_to_won",
    "transition_to_lost",
    "transition_to_disqualified",
  ],
  humanReasonCodesByAction: commercialHumanReasonCodesByAction,
  reasons: commercialReasons,
} as const;

export const policies = {
  opportunityEligibility: {
    ...opportunityEligibilityPolicy,
    digest: hashCanonical(opportunityEligibilityPolicy),
  },
  commercialStateGates: {
    ...commercialStateGatesPolicy,
    digest: hashCanonical(commercialStateGatesPolicy),
  },
} as const;

export interface DecisionEngineContext {
  lead: Lead;
  contactHasChannel: boolean;
  opportunity: Opportunity | null;
  facts: CommercialFactSnapshot[];
  now: string;
}

export interface DecisionEvaluation {
  decisionType: "opportunity_eligibility" | "commercial_state_transition";
  policyKey: string;
  policyVersion: string;
  policyDigest: string;
  decisionSchemaVersion: 1;
  inputSnapshot: Record<string, unknown>;
  inputFingerprint: string;
  outcome: CommercialDecisionOutcome;
  eligibleActions: Array<{
    action: CommercialRequestedAction;
    authorityType: "policy" | "declared_human";
  }>;
  blockedActions: Array<{
    action: CommercialRequestedAction;
    reasonCodes: string[];
  }>;
  missingRequirements: string[];
  requiredEvidence: string[];
  reasonCodes: string[];
  escalationRequired: boolean;
  factIds: string[];
}

const transitionTargets: Partial<
  Record<CommercialRequestedAction, Opportunity["commercialState"]>
> = {
  transition_to_discovery: "discovery",
  transition_to_qualified: "qualified",
  transition_to_proposal: "proposal",
  transition_to_negotiation: "negotiation",
  transition_to_nurture: "nurture",
  transition_to_won: "won",
  transition_to_lost: "lost",
  transition_to_disqualified: "disqualified",
};

function snapshotMap(
  snapshots: CommercialFactSnapshot[],
): Map<CommercialFactKey, CommercialFactSnapshot> {
  return new Map(snapshots.map((snapshot) => [snapshot.factKey, snapshot]));
}

function orderedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function factValue(
  facts: Map<CommercialFactKey, CommercialFactSnapshot>,
  key: CommercialFactKey,
  missing: string[],
  reasons: string[],
): unknown {
  const snapshot = facts.get(key);
  if (snapshot == null || snapshot.status === "unknown") {
    missing.push(key);
    reasons.push("fact_unknown");
    return undefined;
  }
  if (snapshot.status === "conflicting") {
    reasons.push("fact_conflict");
    return undefined;
  }
  return snapshot.value;
}

function requireTrue(
  facts: Map<CommercialFactKey, CommercialFactSnapshot>,
  key: CommercialFactKey,
  reason: string,
  missing: string[],
  reasons: string[],
): void {
  const value = factValue(facts, key, missing, reasons);
  if (value === false) reasons.push(reason);
}

function structuralReason(
  action: CommercialRequestedAction,
  context: DecisionEngineContext,
): string | undefined {
  if (action === "create_opportunity") {
    if (context.lead.status !== "open") return "lead_not_open";
    if (context.opportunity != null) return "opportunity_already_exists";
    return undefined;
  }
  if (context.opportunity == null) return "lead_not_open";
  const target = transitionTargets[action];
  const allowed = commercialTransitions[
    context.opportunity.commercialState
  ] as readonly Opportunity["commercialState"][];
  if (target == null || !allowed.includes(target)) {
    return "lead_not_open";
  }
  return undefined;
}

function hardExclusions(
  facts: Map<CommercialFactKey, CommercialFactSnapshot>,
  missing: string[],
  reasons: string[],
): string[] {
  const hard: string[] = [];
  const crm = factValue(facts, "uses_crm", missing, reasons);
  const sellers = factValue(facts, "seller_count", missing, reasons);
  const inbound = factValue(facts, "has_recurring_inbound", missing, reasons);
  if (crm === false) hard.push("crm_not_used");
  if (sellers === 0) hard.push("no_sellers");
  if (inbound === false) hard.push("no_recurring_inbound");
  return hard;
}

function evaluateOpportunityFit(
  facts: Map<CommercialFactKey, CommercialFactSnapshot>,
  missing: string[],
  reasons: string[],
): string[] {
  const review: string[] = [];
  const ownership = factValue(
    facts,
    "company_ownership_type",
    missing,
    reasons,
  );
  const salesProcess = factValue(
    facts,
    "has_existing_sales_process",
    missing,
    reasons,
  );
  const sellers = facts.get("seller_count")?.value;
  const owner = factValue(facts, "commercial_owner_defined", missing, reasons);
  const volume = factValue(facts, "monthly_lead_volume", missing, reasons);
  const ticket = factValue(facts, "average_ticket_brl_cents", missing, reasons);
  const conversion = factValue(facts, "measures_conversion", missing, reasons);
  const roi = factValue(facts, "roi_provable_within_90_days", missing, reasons);

  if (ownership !== undefined && ownership !== "private")
    review.push("non_private_profile_requires_review");
  if (salesProcess === false) review.push("sales_process_requires_review");
  if (
    typeof sellers === "number" &&
    sellers > 0 &&
    sellers < policies.opportunityEligibility.standard.sellerCount
  )
    review.push("seller_count_requires_review");
  if (owner === false) review.push("commercial_owner_requires_review");
  if (
    typeof volume === "number" &&
    volume < policies.opportunityEligibility.standard.monthlyLeadVolume
  )
    review.push("lead_volume_requires_review");
  if (
    typeof ticket === "number" &&
    ticket < policies.opportunityEligibility.standard.averageTicketBrlCents
  )
    review.push("average_ticket_requires_review");
  if (conversion === false) review.push("conversion_measurement_gap");
  if (roi === false) review.push("roi_window_requires_review");

  requireTrue(facts, "pain_confirmed", "pain_not_confirmed", missing, reasons);
  requireTrue(facts, "pain_recurring", "pain_not_recurring", missing, reasons);
  requireTrue(
    facts,
    "pain_measurable",
    "pain_not_measurable",
    missing,
    reasons,
  );
  const cycle = facts.get("sales_cycle_days");
  if (
    cycle?.status === "consistent" &&
    typeof cycle.value === "number" &&
    cycle.value > policies.opportunityEligibility.standard.salesCycleDays
  ) {
    reasons.push("long_sales_cycle_priority_signal");
  }
  return review;
}

function hasHumanApproval(input: CreateCommercialDecisionInput): boolean {
  return (
    input.authorityType === "declared_human" &&
    input.reasonCode != null &&
    input.evidence != null &&
    isCommercialHumanReasonAllowed(input.requestedAction, input.reasonCode)
  );
}

export function evaluateCommercialDecision(
  input: CreateCommercialDecisionInput,
  context: DecisionEngineContext,
): DecisionEvaluation {
  const policy =
    input.requestedAction === "create_opportunity"
      ? policies.opportunityEligibility
      : policies.commercialStateGates;
  const facts = snapshotMap(context.facts);
  const missing: string[] = [];
  const reasons: string[] = [];
  const requiredEvidence: string[] = [];
  const blockingReasons: string[] = [];
  const reviewReasons: string[] = [];
  let outcome: CommercialDecisionOutcome = "allow";
  let humanOnly = false;
  let disqualificationCandidate = false;

  const structural = structuralReason(input.requestedAction, context);
  if (structural != null) {
    outcome = "block";
    reasons.push(structural);
  } else if (input.requestedAction === "create_opportunity") {
    if (!context.contactHasChannel) {
      missing.push("contact_has_reachable_channel");
      reasons.push("contact_channel_missing");
    }
    const hard = hardExclusions(facts, missing, reasons);
    const review = evaluateOpportunityFit(facts, missing, reasons);
    reasons.push(...hard, ...review);
    blockingReasons.push(
      ...hard,
      ...reasons.filter((code) => code.startsWith("pain_not_")),
    );
    reviewReasons.push(...review);
  } else if (input.requestedAction === "transition_to_discovery") {
    requireTrue(
      facts,
      "pain_confirmed",
      "pain_not_confirmed",
      missing,
      reasons,
    );
    requireTrue(
      facts,
      "pain_recurring",
      "pain_not_recurring",
      missing,
      reasons,
    );
    requireTrue(
      facts,
      "pain_measurable",
      "pain_not_measurable",
      missing,
      reasons,
    );
    blockingReasons.push(
      ...reasons.filter((code) => code.startsWith("pain_not_")),
    );
  } else if (input.requestedAction === "transition_to_qualified") {
    requireTrue(
      facts,
      "decision_maker_access_confirmed",
      "decision_maker_access_not_confirmed",
      missing,
      reasons,
    );
    requireTrue(
      facts,
      "budget_confirmed",
      "budget_not_confirmed",
      missing,
      reasons,
    );
    requireTrue(
      facts,
      "operational_capacity_confirmed",
      "operational_capacity_not_confirmed",
      missing,
      reasons,
    );
    const timing = factValue(facts, "timing_status", missing, reasons);
    if (timing !== undefined && timing !== "available_now")
      reasons.push("timing_not_available");
    blockingReasons.push(
      ...reasons.filter((code) =>
        [
          "decision_maker_access_not_confirmed",
          "budget_not_confirmed",
          "operational_capacity_not_confirmed",
          "timing_not_available",
        ].includes(code),
      ),
    );
    humanOnly = true;
  } else if (input.requestedAction === "transition_to_nurture") {
    const hard = hardExclusions(facts, missing, reasons);
    const review = evaluateOpportunityFit(facts, missing, reasons);
    const timing = factValue(facts, "timing_status", missing, reasons);
    const revisitAt = factValue(facts, "revisit_at", missing, reasons);
    const returnCondition = factValue(
      facts,
      "nurture_return_condition",
      missing,
      reasons,
    );
    const timingInvalid =
      timing !== undefined && timing !== "temporarily_unavailable";
    const revisitInvalid =
      revisitAt !== undefined &&
      (typeof revisitAt !== "string" ||
        new Date(revisitAt).getTime() <= new Date(context.now).getTime());
    const returnConditionInvalid =
      returnCondition !== undefined &&
      (typeof returnCondition !== "string" || returnCondition.length === 0);
    if (timingInvalid) reasons.push("timing_not_available");
    if (revisitAt === undefined || revisitInvalid)
      reasons.push("nurture_revisit_missing");
    if (returnCondition === undefined || returnConditionInvalid)
      reasons.push("nurture_return_condition_missing");
    reasons.push(...hard, ...review);
    blockingReasons.push(
      ...hard,
      ...reasons.filter((code) => code.startsWith("pain_not_")),
      ...(timingInvalid ? ["timing_not_available"] : []),
      ...(revisitInvalid ? ["nurture_revisit_missing"] : []),
      ...(returnConditionInvalid ? ["nurture_return_condition_missing"] : []),
    );
    reviewReasons.push(...review);
  } else if (input.requestedAction === "transition_to_disqualified") {
    const hard = hardExclusions(facts, missing, reasons);
    reasons.push(...hard);
    disqualificationCandidate = hard.length > 0;
    if (disqualificationCandidate) {
      missing.splice(0, missing.length);
      for (let index = reasons.length - 1; index >= 0; index -= 1) {
        if (reasons[index] === "fact_unknown") reasons.splice(index, 1);
      }
    }
    humanOnly = true;
  } else {
    humanOnly = true;
  }

  if (structural == null) {
    if (reasons.includes("fact_conflict")) {
      outcome = "require_human_review";
    } else if (blockingReasons.length > 0) {
      outcome = "block";
    } else if (missing.length > 0) {
      outcome = "require_information";
    } else if (
      input.requestedAction === "transition_to_disqualified" &&
      !disqualificationCandidate
    ) {
      outcome = "block";
    } else if (
      input.authorityType === "declared_human" &&
      !humanOnly &&
      reviewReasons.length === 0
    ) {
      outcome = "block";
    } else if (
      (reviewReasons.length > 0 || humanOnly) &&
      !hasHumanApproval(input)
    ) {
      reasons.push("human_authority_required");
      requiredEvidence.push("human_attestation");
      outcome = "require_human_review";
    }
  }

  const factIds = orderedUnique(
    context.facts.flatMap((snapshot) => snapshot.facts.map((fact) => fact.id)),
  );
  const inputSnapshot = {
    canonicalizationVersion: 1,
    leadId: context.lead.id,
    leadStatus: context.lead.status,
    contactHasChannel: context.contactHasChannel,
    opportunityId: context.opportunity?.id ?? null,
    opportunityState: context.opportunity?.commercialState ?? null,
    requestedAction: input.requestedAction,
    factIds,
  };
  const inputFingerprint = hashCanonical({
    ...inputSnapshot,
    facts: context.facts.map((snapshot) => ({
      factKey: snapshot.factKey,
      factSchemaVersion: snapshot.factSchemaVersion,
      status: snapshot.status,
      value: snapshot.value,
      factIds: snapshot.facts.map((fact) => fact.id).sort(),
    })),
    policyKey: policy.key,
    policyVersion: policy.version,
    policyDigest: policy.digest,
  });
  const uniqueReasons = orderedUnique(reasons);
  return {
    decisionType:
      input.requestedAction === "create_opportunity"
        ? "opportunity_eligibility"
        : "commercial_state_transition",
    policyKey: policy.key,
    policyVersion: policy.version,
    policyDigest: policy.digest,
    decisionSchemaVersion: 1,
    inputSnapshot,
    inputFingerprint,
    outcome,
    eligibleActions:
      outcome === "allow"
        ? [
            {
              action: input.requestedAction,
              authorityType: input.authorityType,
            },
          ]
        : [],
    blockedActions:
      outcome === "allow"
        ? []
        : [{ action: input.requestedAction, reasonCodes: uniqueReasons }],
    missingRequirements: orderedUnique(missing),
    requiredEvidence: orderedUnique(requiredEvidence),
    reasonCodes: uniqueReasons,
    escalationRequired: outcome === "require_human_review",
    factIds,
  };
}
