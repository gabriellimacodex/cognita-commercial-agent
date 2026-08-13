import { describe, expect, it } from "vitest";

import type {
  CommercialFactKey,
  CommercialFactSnapshot,
} from "@cognita/schemas";

import { planCommercialAction } from "./commercial-action-planner.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const leadId = "00000000-0000-4000-8000-000000000002";

function fact(
  factKey: CommercialFactKey,
  value: boolean | number | string,
): CommercialFactSnapshot {
  return {
    factKey,
    factSchemaVersion: 1,
    status: "consistent",
    value,
    facts: [
      {
        id: `00000000-0000-4000-8000-${String(factKey.length).padStart(12, "0")}`,
        organizationId,
        leadId,
        factKey,
        factSchemaVersion: 1,
        valueType:
          typeof value === "boolean"
            ? "boolean"
            : typeof value === "number"
              ? "integer"
              : "string",
        value,
        sourceType: "human_declaration",
        sourceRef: "planner-test",
        declarerRef: "human:test",
        authorityType: null,
        authorityRef: null,
        executorRef: "test",
        evidence: factKey.startsWith("pain_")
          ? { type: "human_attestation", ref: "planner-test" }
          : null,
        observedAt: "2026-08-13T12:00:00.000Z",
        recordedAt: "2026-08-13T12:00:00.000Z",
        active: true,
        correctedFactIds: [],
      },
    ],
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

function context(facts = standardFacts()) {
  return {
    lead: {
      id: leadId,
      organizationId,
      contactId: "00000000-0000-4000-8000-000000000003",
      companyId: null,
      source: "planner-test",
      status: "open" as const,
      externalNamespace: null,
      externalId: null,
      closedAt: null,
      convertedAt: null,
      createdAt: "2026-08-13T12:00:00.000Z",
      updatedAt: "2026-08-13T12:00:00.000Z",
    },
    contactHasChannel: true,
    opportunity: null,
    facts,
    now: "2026-08-13T12:00:00.000Z",
  };
}

function opportunityContext(
  commercialState: "open" | "discovery" | "qualified",
  facts = standardFacts(),
) {
  return {
    ...context(facts),
    opportunity: {
      id: "00000000-0000-4000-8000-000000000004",
      organizationId,
      leadId,
      commercialState,
      lastTransitionReasonCode: null,
      createdAt: "2026-08-13T12:00:00.000Z",
      updatedAt: "2026-08-13T12:00:00.000Z",
    },
  };
}

describe("Commercial Action Planner v1", () => {
  it("proposes create_opportunity for a standard-fit open Lead without authorizing it", () => {
    const result = planCommercialAction(context());

    expect(result.resultType).toBe("candidate");
    expect(result.candidate).toMatchObject({
      candidateType: "submit_material_action",
      requestedAction: "create_opportunity",
      requiredCapabilityKey: "submit_commercial_decision_v1",
      requirementId: null,
    });
    expect(result.objective.key).toBe("progress_commercial_case");
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("confidence");
    expect(result).not.toHaveProperty("authorityType");
  });

  it("selects only the first actually missing requirement from the fixed priority", () => {
    const result = planCommercialAction(
      context(
        standardFacts().filter(
          ({ factKey }) =>
            factKey !== "company_ownership_type" && factKey !== "uses_crm",
        ),
      ),
    );

    expect(result.candidate).toMatchObject({
      candidateType: "collect_requirement",
      requirementId: "company_ownership_type_known",
      requiredCapabilityKey: "collect_commercial_requirement_v1",
    });
  });

  it("routes reviewable policy exceptions to human review without granting authority", () => {
    const facts = standardFacts().map((snapshot) =>
      snapshot.factKey === "measures_conversion"
        ? fact("measures_conversion", false)
        : snapshot,
    );

    const result = planCommercialAction(context(facts));

    expect(result.candidate).toMatchObject({
      candidateType: "request_human_review",
      requiredCapabilityKey: "review_commercial_exception_v1",
    });
    expect(result.candidate?.decisionReasonCodes).toContain(
      "conversion_measurement_gap",
    );
    expect(result.resultType).toBe("candidate");
  });

  it("requires Fact correction rather than a Decision for conflicting Facts", () => {
    const ownership = fact("company_ownership_type", "private");
    ownership.status = "conflicting";
    ownership.value = null;
    ownership.facts.push({
      ...ownership.facts[0]!,
      id: "00000000-0000-4000-8000-000000000099",
      value: "public",
    });
    const result = planCommercialAction(
      context([
        ownership,
        ...standardFacts().filter(
          ({ factKey }) => factKey !== "company_ownership_type",
        ),
      ]),
    );

    expect(result.candidate).toMatchObject({
      candidateType: "request_human_review",
      requiredCapabilityKey: "resolve_commercial_fact_conflict_v1",
      rationaleCodes: ["fact_conflict_requires_resolution"],
    });
  });

  it("collects budget before qualification when discovery lacks that Fact", () => {
    const result = planCommercialAction(
      opportunityContext("discovery", [
        ...standardFacts(),
        fact("decision_maker_access_confirmed", true),
      ]),
    );

    expect(result.candidate).toMatchObject({
      requestedAction: "transition_to_qualified",
      candidateType: "collect_requirement",
      requirementId: "budget_known",
    });
  });

  it("produces no_action for contexts outside the Planner v1 catalog", () => {
    const result = planCommercialAction(opportunityContext("qualified"));

    expect(result).toMatchObject({
      resultType: "no_action",
      candidate: null,
      rationaleCodes: ["planner_scope_not_supported"],
      decisionEvaluation: null,
    });
  });

  it("maps a hard exclusion exclusively to no_action", () => {
    const facts = standardFacts().map((snapshot) =>
      snapshot.factKey === "uses_crm" ? fact("uses_crm", false) : snapshot,
    );

    const result = planCommercialAction(context(facts));

    expect(result).toMatchObject({
      resultType: "no_action",
      candidate: null,
      rationaleCodes: ["policy_blocked"],
    });
  });

  it("is deterministic and carries the exact Decision Engine basis fingerprint", () => {
    const first = planCommercialAction(context());
    const second = planCommercialAction(
      context([...standardFacts()].reverse()),
    );

    expect(second.inputFingerprint).toBe(first.inputFingerprint);
    expect(second.outputDigest).toBe(first.outputDigest);
    expect(first.candidate?.decisionBasisFingerprint).toBe(
      first.decisionEvaluation?.inputFingerprint,
    );
  });
});
