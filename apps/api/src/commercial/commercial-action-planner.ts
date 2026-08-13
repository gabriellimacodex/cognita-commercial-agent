import type {
  CommercialFactSnapshot,
  CommercialRequirementId,
  CommercialRequestedAction,
  CreateCommercialDecisionInput,
} from "@cognita/schemas";

import {
  evaluateCommercialDecision,
  policies,
  type DecisionEngineContext,
  type DecisionEvaluation,
} from "./commercial-decision-engine.js";
import { hashCanonical } from "./commercial-domain.js";

const objectiveDefinition = {
  key: "progress_commercial_case",
  version: "1.0.0",
  meaning: "select-the-next-commercial-gate-covered-by-planner-v1",
} as const;

const plannerDefinition = {
  key: "commercial-action-planner",
  version: "1.0.0",
  canonicalizationVersion: 1,
  outcomes: [
    "block:no_action",
    "require_information:collect_requirement",
    "require_human_review:request_human_review",
    "allow:submit_material_action",
  ],
} as const;

const actionCatalogDefinition = {
  key: "commercial-planner-actions",
  version: "1.0.0",
  requestedActions: [
    "create_opportunity",
    "transition_to_discovery",
    "transition_to_qualified",
  ],
} as const;

export const commercialRequirementPriority = [
  "contact_has_reachable_channel",
  "company_ownership_type_known",
  "sales_process_known",
  "crm_usage_known",
  "sales_capacity_known",
  "commercial_owner_known",
  "recurring_inbound_known",
  "lead_volume_known",
  "average_ticket_known",
  "conversion_measurement_known",
  "roi_measurement_known",
  "pain_confirmed_with_evidence",
  "pain_recurring_with_evidence",
  "pain_measurable_with_evidence",
  "decision_maker_access_known",
  "budget_known",
  "operational_capacity_known",
  "timing_known",
  "nurture_revisit_date_known",
  "nurture_return_condition_known",
] as const satisfies readonly CommercialRequirementId[];

const priorityDefinition = {
  key: "commercial-requirement-priority",
  version: "1.0.0",
  requirements: commercialRequirementPriority,
} as const;

function metadata<T extends { key: string; version: string }>(definition: T) {
  return {
    key: definition.key,
    version: definition.version,
    digest: hashCanonical(definition),
  };
}

export const commercialActionPlannerMetadata = {
  objective: metadata(objectiveDefinition),
  planner: metadata(plannerDefinition),
  actionCatalog: metadata(actionCatalogDefinition),
  requirementPriority: metadata(priorityDefinition),
} as const;

export type CommercialActionCandidateType =
  "collect_requirement" | "request_human_review" | "submit_material_action";

export type CommercialActionCapabilityKey =
  | "collect_commercial_requirement_v1"
  | "resolve_commercial_fact_conflict_v1"
  | "review_commercial_exception_v1"
  | "submit_commercial_decision_v1";

export type CommercialActionRationaleCode =
  | "planner_scope_not_supported"
  | "policy_blocked"
  | "missing_requirement_selected"
  | "fact_conflict_requires_resolution"
  | "human_review_required"
  | "material_action_ready";

type PlannerRequestedAction = Extract<
  CommercialRequestedAction,
  "create_opportunity" | "transition_to_discovery" | "transition_to_qualified"
>;

export interface PlannedActionCandidate {
  candidateType: CommercialActionCandidateType;
  requestedAction: PlannerRequestedAction;
  requirementId: CommercialRequirementId | null;
  requiredCapabilityKey: CommercialActionCapabilityKey;
  decisionBasisFingerprint: string;
  rationaleCodes: CommercialActionRationaleCode[];
  decisionReasonCodes: string[];
}

export interface CommercialActionPlanEvaluation {
  objective: typeof commercialActionPlannerMetadata.objective;
  planner: typeof commercialActionPlannerMetadata.planner;
  actionCatalog: typeof commercialActionPlannerMetadata.actionCatalog;
  requirementPriority: typeof commercialActionPlannerMetadata.requirementPriority;
  inputSnapshot: Record<string, unknown>;
  inputFingerprint: string;
  outputDigest: string;
  resultType: "candidate" | "no_action";
  rationaleCodes: CommercialActionRationaleCode[];
  candidate: PlannedActionCandidate | null;
  decisionEvaluation: DecisionEvaluation | null;
}

function requestedActionFor(
  context: DecisionEngineContext,
): PlannerRequestedAction | null {
  if (context.lead.status === "open" && context.opportunity == null) {
    return "create_opportunity";
  }
  if (context.opportunity?.commercialState === "open") {
    return "transition_to_discovery";
  }
  if (context.opportunity?.commercialState === "discovery") {
    return "transition_to_qualified";
  }
  return null;
}

function policyInput(
  context: DecisionEngineContext,
  requestedAction: PlannerRequestedAction,
): CreateCommercialDecisionInput {
  const authorityRef =
    requestedAction === "create_opportunity"
      ? `${policies.opportunityEligibility.key}@${policies.opportunityEligibility.version}`
      : `${policies.commercialStateGates.key}@${policies.commercialStateGates.version}`;
  return {
    organizationId: context.lead.organizationId,
    requestedAction,
    authorityType: "policy",
    authorityRef,
    executorRef: "commercial-action-planner",
    ...(context.opportunity == null
      ? {}
      : { opportunityId: context.opportunity.id }),
  };
}

function canonicalFacts(facts: CommercialFactSnapshot[]) {
  return facts
    .map((snapshot) => ({
      factKey: snapshot.factKey,
      factSchemaVersion: snapshot.factSchemaVersion,
      status: snapshot.status,
      value: snapshot.value,
      factIds: snapshot.facts.map((fact) => fact.id).sort(),
    }))
    .sort((left, right) => left.factKey.localeCompare(right.factKey));
}

function chooseMissingRequirement(
  missing: readonly CommercialRequirementId[],
): CommercialRequirementId {
  const selected = commercialRequirementPriority.find((requirement) =>
    missing.includes(requirement),
  );
  if (selected == null) {
    throw new Error("Decision returned no collectable missing requirement");
  }
  return selected;
}

function candidateFor(
  requestedAction: PlannerRequestedAction,
  evaluation: DecisionEvaluation,
): PlannedActionCandidate | null {
  if (evaluation.outcome === "block") return null;
  if (evaluation.outcome === "require_information") {
    return {
      candidateType: "collect_requirement",
      requestedAction,
      requirementId: chooseMissingRequirement(evaluation.missingRequirements),
      requiredCapabilityKey: "collect_commercial_requirement_v1",
      decisionBasisFingerprint: evaluation.inputFingerprint,
      rationaleCodes: ["missing_requirement_selected"],
      decisionReasonCodes: evaluation.reasonCodes,
    };
  }
  if (evaluation.outcome === "require_human_review") {
    const conflict = evaluation.reasonCodes.includes("fact_conflict");
    return {
      candidateType: "request_human_review",
      requestedAction,
      requirementId: null,
      requiredCapabilityKey: conflict
        ? "resolve_commercial_fact_conflict_v1"
        : "review_commercial_exception_v1",
      decisionBasisFingerprint: evaluation.inputFingerprint,
      rationaleCodes: [
        conflict
          ? "fact_conflict_requires_resolution"
          : "human_review_required",
      ],
      decisionReasonCodes: evaluation.reasonCodes,
    };
  }
  return {
    candidateType: "submit_material_action",
    requestedAction,
    requirementId: null,
    requiredCapabilityKey: "submit_commercial_decision_v1",
    decisionBasisFingerprint: evaluation.inputFingerprint,
    rationaleCodes: ["material_action_ready"],
    decisionReasonCodes: evaluation.reasonCodes,
  };
}

export function planCommercialAction(
  context: DecisionEngineContext,
): CommercialActionPlanEvaluation {
  const requestedAction = requestedActionFor(context);
  const policy =
    requestedAction == null
      ? null
      : requestedAction === "create_opportunity"
        ? policies.opportunityEligibility
        : policies.commercialStateGates;
  const inputSnapshot = {
    canonicalizationVersion: 1,
    organizationId: context.lead.organizationId,
    leadId: context.lead.id,
    leadStatus: context.lead.status,
    contactHasChannel: context.contactHasChannel,
    opportunityId: context.opportunity?.id ?? null,
    opportunityState: context.opportunity?.commercialState ?? null,
    facts: canonicalFacts(context.facts),
    policy:
      policy == null
        ? null
        : { key: policy.key, version: policy.version, digest: policy.digest },
    objective: commercialActionPlannerMetadata.objective,
    planner: commercialActionPlannerMetadata.planner,
    actionCatalog: commercialActionPlannerMetadata.actionCatalog,
    requirementPriority: commercialActionPlannerMetadata.requirementPriority,
    requestedAction,
  };
  const inputFingerprint = hashCanonical(inputSnapshot);
  if (requestedAction == null) {
    const rationaleCodes: CommercialActionRationaleCode[] = [
      "planner_scope_not_supported",
    ];
    return {
      ...commercialActionPlannerMetadata,
      inputSnapshot,
      inputFingerprint,
      outputDigest: hashCanonical({
        resultType: "no_action",
        candidate: null,
        rationaleCodes,
      }),
      resultType: "no_action",
      rationaleCodes,
      candidate: null,
      decisionEvaluation: null,
    };
  }
  const decisionEvaluation = evaluateCommercialDecision(
    policyInput(context, requestedAction),
    {
      ...context,
      facts: [...context.facts].sort((left, right) =>
        left.factKey.localeCompare(right.factKey),
      ),
    },
  );
  const candidate = candidateFor(requestedAction, decisionEvaluation);
  const rationaleCodes: CommercialActionRationaleCode[] =
    candidate?.rationaleCodes ?? ["policy_blocked"];
  const resultType = candidate == null ? "no_action" : "candidate";
  return {
    ...commercialActionPlannerMetadata,
    inputSnapshot,
    inputFingerprint,
    outputDigest: hashCanonical({ resultType, candidate, rationaleCodes }),
    resultType,
    rationaleCodes,
    candidate,
    decisionEvaluation,
  };
}
