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
    expect(result.missingRequirements).toContain("measures_conversion");
    expect(result.reasonCodes).toContain("fact_unknown");
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
