import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  CommercialFact,
  CommercialFactKey,
  CommercialFactSnapshot,
  CreateCommercialDecisionInput,
} from "@cognita/schemas";

import {
  evaluateCommercialDecision,
  policies,
  requiredFactRequirementIds,
} from "./commercial-decision-engine.js";

function fact(
  factKey: CommercialFactKey,
  value: CommercialFact["value"],
  options: { conflict?: boolean } = {},
): CommercialFactSnapshot {
  const make = (item: CommercialFact["value"]): CommercialFact => ({
    id: randomUUID(),
    organizationId: "00000000-0000-4000-8000-000000000001",
    leadId: "00000000-0000-4000-8000-000000000002",
    factKey,
    factSchemaVersion: 1,
    valueType:
      typeof item === "boolean"
        ? "boolean"
        : typeof item === "number"
          ? "integer"
          : factKey === "revisit_at"
            ? "timestamp"
            : "string",
    value: item,
    sourceType: "human_declaration",
    sourceRef: "golden-test",
    declarerRef: "human:test",
    authorityType: null,
    authorityRef: null,
    executorRef: "test",
    evidence: factKey.startsWith("pain_")
      ? { type: "human_attestation", ref: "golden-test" }
      : null,
    observedAt: "2026-08-11T12:00:00.000Z",
    recordedAt: "2026-08-11T12:00:00.000Z",
    active: true,
    correctedFactIds: [],
  });
  const facts = options.conflict
    ? [make(value), make(typeof value === "boolean" ? !value : "other")]
    : [make(value)];
  return {
    factKey,
    factSchemaVersion: 1,
    status: options.conflict ? "conflicting" : "consistent",
    value: options.conflict ? null : value,
    facts,
  };
}

function standardFacts(): CommercialFactSnapshot[] {
  return [
    fact("company_ownership_type", "private"),
    fact("has_existing_sales_process", true),
    fact("uses_crm", true),
    fact("seller_count", 3),
    fact("commercial_owner_defined", true),
    fact("has_recurring_inbound", true),
    fact("monthly_lead_volume", 500),
    fact("average_ticket_brl_cents", 500_000),
    fact("measures_conversion", true),
    fact("roi_provable_within_90_days", true),
    fact("pain_confirmed", true),
    fact("pain_recurring", true),
    fact("pain_measurable", true),
  ];
}

function completeFacts(): CommercialFactSnapshot[] {
  return [
    ...standardFacts(),
    fact("decision_maker_access_confirmed", true),
    fact("budget_confirmed", true),
    fact("operational_capacity_confirmed", true),
    fact("timing_status", "available_now"),
    fact("revisit_at", "2026-12-01T12:00:00.000Z"),
    fact("nurture_return_condition", "timing_window_opens"),
  ];
}

const policyInput: CreateCommercialDecisionInput = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  requestedAction: "create_opportunity",
  authorityType: "policy",
  authorityRef: "opportunity-eligibility@1.0.0",
  executorRef: "test",
};

function evaluate(
  facts: CommercialFactSnapshot[],
  input: CreateCommercialDecisionInput = policyInput,
  contactHasChannel = true,
) {
  return evaluateCommercialDecision(input, {
    lead: {
      id: "00000000-0000-4000-8000-000000000002",
      organizationId: input.organizationId,
      contactId: "00000000-0000-4000-8000-000000000003",
      companyId: null,
      source: "test",
      status: "open",
      externalNamespace: null,
      externalId: null,
      closedAt: null,
      convertedAt: null,
      createdAt: "2026-08-11T12:00:00.000Z",
      updatedAt: "2026-08-11T12:00:00.000Z",
    },
    contactHasChannel,
    opportunity: null,
    facts,
    now: "2026-08-11T12:00:00.000Z",
  });
}

describe("Commercial Decision Engine policy v1 golden cases", () => {
  it("allows the exact standard fit deterministically", () => {
    const first = evaluate(standardFacts());
    const second = evaluate(standardFacts().map((item) => ({ ...item })));
    expect(first.outcome).toBe("allow");
    expect(first.policyDigest).toBe(policies.opportunityEligibility.digest);
    expect(second.policyDigest).toBe(first.policyDigest);
    expect(first).not.toHaveProperty("score");
    expect(first).not.toHaveProperty("confidence");
  });

  it("routes measures_conversion=false to human review without terminal exclusion", () => {
    const facts = standardFacts().map((item) =>
      item.factKey === "measures_conversion"
        ? fact("measures_conversion", false)
        : item,
    );
    const result = evaluate(facts);
    expect(result.outcome).toBe("require_human_review");
    expect(result.reasonCodes).toContain("conversion_measurement_gap");
    expect(result.reasonCodes).not.toContain("crm_not_used");
  });

  it("treats an absent Fact as information required, never false", () => {
    const result = evaluate(
      standardFacts().filter((item) => item.factKey !== "measures_conversion"),
    );
    expect(result.outcome).toBe("require_information");
    expect(result.missingRequirements).toContain(
      "conversion_measurement_known",
    );
    expect(result.reasonCodes).toContain("fact_unknown");
  });

  it("uses the canonical requirement ID for missing company ownership", () => {
    const result = evaluate(
      standardFacts().filter(
        (item) => item.factKey !== "company_ownership_type",
      ),
    );

    expect(result.outcome).toBe("require_information");
    expect(result.missingRequirements).toContain(
      "company_ownership_type_known",
    );
    expect(result.missingRequirements).not.toContain("company_ownership_type");
  });

  it("defines an explicit canonical requirement for every required Fact", () => {
    expect(requiredFactRequirementIds).toEqual({
      company_ownership_type: "company_ownership_type_known",
      has_existing_sales_process: "sales_process_known",
      uses_crm: "crm_usage_known",
      seller_count: "sales_capacity_known",
      commercial_owner_defined: "commercial_owner_known",
      has_recurring_inbound: "recurring_inbound_known",
      monthly_lead_volume: "lead_volume_known",
      average_ticket_brl_cents: "average_ticket_known",
      measures_conversion: "conversion_measurement_known",
      roi_provable_within_90_days: "roi_measurement_known",
      pain_confirmed: "pain_confirmed_with_evidence",
      pain_recurring: "pain_recurring_with_evidence",
      pain_measurable: "pain_measurable_with_evidence",
      decision_maker_access_confirmed: "decision_maker_access_known",
      budget_confirmed: "budget_known",
      operational_capacity_confirmed: "operational_capacity_known",
      timing_status: "timing_known",
      revisit_at: "nurture_revisit_date_known",
      nurture_return_condition: "nurture_return_condition_known",
    });
    expect(requiredFactRequirementIds).not.toHaveProperty("sales_cycle_days");
  });

  it.each([
    [
      "company_ownership_type",
      "company_ownership_type_known",
      "create_opportunity",
    ],
    ["has_existing_sales_process", "sales_process_known", "create_opportunity"],
    ["uses_crm", "crm_usage_known", "create_opportunity"],
    ["seller_count", "sales_capacity_known", "create_opportunity"],
    [
      "commercial_owner_defined",
      "commercial_owner_known",
      "create_opportunity",
    ],
    ["has_recurring_inbound", "recurring_inbound_known", "create_opportunity"],
    ["monthly_lead_volume", "lead_volume_known", "create_opportunity"],
    ["average_ticket_brl_cents", "average_ticket_known", "create_opportunity"],
    [
      "measures_conversion",
      "conversion_measurement_known",
      "create_opportunity",
    ],
    [
      "roi_provable_within_90_days",
      "roi_measurement_known",
      "create_opportunity",
    ],
    ["pain_confirmed", "pain_confirmed_with_evidence", "create_opportunity"],
    ["pain_recurring", "pain_recurring_with_evidence", "create_opportunity"],
    ["pain_measurable", "pain_measurable_with_evidence", "create_opportunity"],
    [
      "decision_maker_access_confirmed",
      "decision_maker_access_known",
      "transition_to_qualified",
    ],
    ["budget_confirmed", "budget_known", "transition_to_qualified"],
    [
      "operational_capacity_confirmed",
      "operational_capacity_known",
      "transition_to_qualified",
    ],
    ["timing_status", "timing_known", "transition_to_qualified"],
    ["revisit_at", "nurture_revisit_date_known", "transition_to_nurture"],
    [
      "nurture_return_condition",
      "nurture_return_condition_known",
      "transition_to_nurture",
    ],
  ] as const)(
    "maps absent %s to %s and removes it when present",
    (factKey, requirementId, action) => {
      const allFacts = completeFacts().map((snapshot) =>
        action === "transition_to_nurture" &&
        snapshot.factKey === "timing_status"
          ? fact("timing_status", "temporarily_unavailable")
          : snapshot,
      );
      const input: CreateCommercialDecisionInput = {
        organizationId: policyInput.organizationId,
        requestedAction: action,
        authorityType: "policy",
        authorityRef:
          action === "create_opportunity"
            ? "opportunity-eligibility@1.0.0"
            : "commercial-state-gates@1.0.0",
        executorRef: "test",
        ...(action === "create_opportunity"
          ? {}
          : { opportunityId: "00000000-0000-4000-8000-000000000004" }),
      };
      const context = {
        lead: {
          id: "00000000-0000-4000-8000-000000000002",
          organizationId: input.organizationId,
          contactId: "00000000-0000-4000-8000-000000000003",
          companyId: null,
          source: "test",
          status: "open" as const,
          externalNamespace: null,
          externalId: null,
          closedAt: null,
          convertedAt: null,
          createdAt: "2026-08-11T12:00:00.000Z",
          updatedAt: "2026-08-11T12:00:00.000Z",
        },
        contactHasChannel: true,
        opportunity:
          action === "create_opportunity"
            ? null
            : {
                id: "00000000-0000-4000-8000-000000000004",
                organizationId: input.organizationId,
                leadId: "00000000-0000-4000-8000-000000000002",
                commercialState:
                  action === "transition_to_qualified"
                    ? ("discovery" as const)
                    : ("open" as const),
                lastTransitionReasonCode: null,
                createdAt: "2026-08-11T12:00:00.000Z",
                updatedAt: "2026-08-11T12:00:00.000Z",
              },
        facts: allFacts,
        now: "2026-08-11T12:00:00.000Z",
      };
      const absent = evaluateCommercialDecision(input, {
        ...context,
        facts: allFacts.filter((snapshot) => snapshot.factKey !== factKey),
      });
      const present = evaluateCommercialDecision(input, context);
      expect(absent.missingRequirements).toContain(requirementId);
      expect(present.missingRequirements).not.toContain(requirementId);
    },
  );

  it("does not treat absent sales_cycle_days as a missing requirement", () => {
    const result = evaluate(standardFacts());
    expect(result.missingRequirements).not.toContain(
      "sales_cycle_days" as never,
    );
    expect(result.outcome).toBe("allow");
  });

  it("treats a missing contact channel as information required", () => {
    const result = evaluate(standardFacts(), policyInput, false);
    expect(result.outcome).toBe("require_information");
    expect(result.missingRequirements).toContain(
      "contact_has_reachable_channel",
    );
  });

  it("gives a conflicting Fact precedence over a separate hard exclusion", () => {
    const facts = standardFacts().map((item) => {
      if (item.factKey === "uses_crm") return fact("uses_crm", false);
      if (item.factKey === "measures_conversion")
        return fact("measures_conversion", true, { conflict: true });
      return item;
    });
    expect(evaluate(facts).outcome).toBe("require_human_review");
  });

  it("allows an action-specific human review but rejects a generic reason", () => {
    const facts = standardFacts().map((item) =>
      item.factKey === "measures_conversion"
        ? fact("measures_conversion", false)
        : item,
    );
    const reviewed = evaluate(facts, {
      ...policyInput,
      authorityType: "declared_human",
      authorityRef: "human:founder",
      reasonCode: "conversion_measurement_gap",
      evidence: { type: "human_attestation", ref: "reviewed" },
    });
    const generic = evaluate(facts, {
      ...policyInput,
      authorityType: "declared_human",
      authorityRef: "human:founder",
      reasonCode: "other_human_confirmed",
      evidence: { type: "human_attestation", ref: "reviewed" },
    });
    expect(reviewed.outcome).toBe("allow");
    expect(generic.outcome).toBe("require_human_review");
  });

  it("does not let declared_human replace policy on an unexceptional standard fit", () => {
    const result = evaluate(standardFacts(), {
      ...policyInput,
      authorityType: "declared_human",
      authorityRef: "human:founder",
      reasonCode: "conversion_measurement_gap",
      evidence: { type: "human_attestation", ref: "reviewed" },
    });
    expect(result.outcome).toBe("block");
    expect(result.eligibleActions).toEqual([]);
  });

  it("does not allow declared_human to bypass hard exclusions", () => {
    const facts = standardFacts().map((item) =>
      item.factKey === "uses_crm" ? fact("uses_crm", false) : item,
    );
    const result = evaluate(facts, {
      ...policyInput,
      authorityType: "declared_human",
      authorityRef: "human:founder",
      reasonCode: "human_qualification_confirmed",
      evidence: { type: "human_attestation", ref: "reviewed" },
    });
    expect(result.outcome).toBe("block");
    expect(result.reasonCodes).toContain("crm_not_used");
  });

  it("does not let a human Decision resolve conflicting Facts", () => {
    const facts = standardFacts().map((item) =>
      item.factKey === "measures_conversion"
        ? fact("measures_conversion", true, { conflict: true })
        : item,
    );
    const result = evaluate(facts, {
      ...policyInput,
      authorityType: "declared_human",
      authorityRef: "human:founder",
      reasonCode: "human_qualification_confirmed",
      evidence: { type: "human_attestation", ref: "reviewed" },
    });
    expect(result.outcome).toBe("require_human_review");
    expect(result.reasonCodes).toContain("fact_conflict");
  });
});
