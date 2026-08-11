import { describe, expect, it } from "vitest";

import {
  createCompanyInputSchema,
  createCommercialDecisionInputSchema,
  createContactInputSchema,
  createLeadInputSchema,
  createMessageInputSchema,
  opportunityStateSchema,
  transitionOpportunityInputSchema,
} from "./commercial.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const contactId = "00000000-0000-4000-8000-000000000002";

describe("commercial contracts", () => {
  it("allows a Lead without Company or external identity", () => {
    expect(
      createLeadInputSchema.safeParse({
        organizationId,
        contactId,
        source: "local",
        actorRef: "founder",
      }).success,
    ).toBe(true);
  });

  it("requires a complete external identity pair", () => {
    expect(
      createLeadInputSchema.safeParse({
        organizationId,
        contactId,
        source: "local",
        externalId: "lead-1",
        actorRef: "founder",
      }).success,
    ).toBe(false);
    expect(
      createMessageInputSchema.safeParse({
        organizationId,
        body: "synthetic",
        occurredAt: "2026-08-10T12:00:00.000Z",
        externalNamespace: "test/account",
        externalId: "message-1",
        actorRef: "founder",
      }).success,
    ).toBe(true);
  });

  it("exposes only the accepted commercial states", () => {
    expect(opportunityStateSchema.safeParse("discovery").success).toBe(true);
    expect(opportunityStateSchema.safeParse("meeting_scheduled").success).toBe(
      false,
    );
  });

  it("rejects malformed normalized identity candidates at the API boundary", () => {
    expect(
      createCompanyInputSchema.safeParse({
        organizationId,
        name: "Synthetic",
        domain: "not a domain",
        actorRef: "founder",
      }).success,
    ).toBe(false);
    expect(
      createContactInputSchema.safeParse({
        organizationId,
        name: "Synthetic",
        phone: "not a phone",
        actorRef: "founder",
      }).success,
    ).toBe(false);
  });

  it("closes policy authority and human reason contracts", () => {
    expect(
      createCommercialDecisionInputSchema.safeParse({
        organizationId,
        requestedAction: "create_opportunity",
        authorityType: "policy",
        authorityRef: "wrong-policy@1.0.0",
        executorRef: "test",
      }).success,
    ).toBe(false);
    expect(
      createCommercialDecisionInputSchema.safeParse({
        organizationId,
        requestedAction: "create_opportunity",
        authorityType: "declared_human",
        authorityRef: "human:founder",
        executorRef: "test",
        reasonCode: "other_human_confirmed",
        evidence: { type: "human_attestation", ref: "review" },
      }).success,
    ).toBe(false);
    expect(
      createCommercialDecisionInputSchema.safeParse({
        organizationId,
        requestedAction: "create_opportunity",
        authorityType: "declared_human",
        authorityRef: "human:founder",
        executorRef: "test",
        reasonCode: "conversion_measurement_gap",
        evidence: { type: "human_attestation", ref: "review" },
      }).success,
    ).toBe(true);
  });

  it("accepts only a reason code valid for the transition target", () => {
    const decisionId = "00000000-0000-4000-8000-000000000004";
    expect(
      transitionOpportunityInputSchema.safeParse({
        organizationId,
        toState: "discovery",
        reasonCode: "discovery_started",
        decisionId,
        actorRef: "human:founder",
      }).success,
    ).toBe(true);
    expect(
      transitionOpportunityInputSchema.safeParse({
        organizationId,
        toState: "discovery",
        reasonCode: "other_human_confirmed",
        decisionId,
        actorRef: "human:founder",
      }).success,
    ).toBe(false);
  });
});
