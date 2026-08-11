import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { Migrator } from "kysely/migration";

import {
  CommercialRepository,
  CommercialDecisionRepository,
  createDatabase,
  FoundationJobRepository,
  migrationProvider,
} from "@cognita/database";
import { createLogger } from "@cognita/observability";
import {
  apiErrorSchema,
  commercialCommandReceiptSchema,
  commercialDecisionSchema,
  commercialFactSnapshotSchema,
  commercialTimelineSchema,
  companySchema,
  contactSchema,
  conversationSchema,
  leadContextSchema,
  leadSchema,
  opportunitySchema,
  organizationSchema,
  type CommercialFactKey,
  type CommercialRequestedAction,
  type CommercialCommandReceipt,
} from "@cognita/schemas";

import { FoundationJobService } from "../../apps/api/src/application/foundation-job-service.js";
import { CommercialService } from "../../apps/api/src/commercial/commercial-service.js";
import { buildApi } from "../../apps/api/src/server.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl == null) {
  throw new Error("DATABASE_URL is required for commercial integration tests");
}

const database = createDatabase({ connectionString: databaseUrl });
const logger = createLogger({
  service: "commercial-integration-test",
  environment: "test",
  version: "test",
});
const foundationService = new FoundationJobService(
  new FoundationJobRepository(database),
  { publish: async () => undefined },
);
const commercialService = new CommercialService(
  new CommercialRepository(database),
  new CommercialDecisionRepository(database),
  logger,
);
const api = await buildApi({
  service: foundationService,
  commercialService,
  checkDatabase: async () => undefined,
  checkRedis: async () => undefined,
  logger,
});

async function commercialCommand(
  method: "POST" | "PUT",
  path: string,
  payload: Record<string, unknown>,
  idempotencyKey: string = randomUUID(),
) {
  return api.inject({
    method,
    url: path,
    headers: { "idempotency-key": idempotencyKey },
    payload,
  });
}

async function successfulCommand(
  method: "POST" | "PUT",
  path: string,
  payload: Record<string, unknown>,
  idempotencyKey: string = randomUUID(),
): Promise<CommercialCommandReceipt> {
  const response = await commercialCommand(
    method,
    path,
    payload,
    idempotencyKey,
  );
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  return commercialCommandReceiptSchema.parse(response.json());
}

async function createOrganization(name = "Synthetic Organization") {
  const organizationId = randomUUID();
  await successfulCommand("POST", "/commercial/organizations", {
    organizationId,
    name,
    actorRef: "test-human",
  });
  return organizationId;
}

async function createContact(organizationId: string, companyId?: string) {
  return successfulCommand("POST", "/commercial/contacts", {
    organizationId,
    name: "Synthetic Contact",
    email: `${randomUUID()}@example.test`,
    ...(companyId == null ? {} : { companyId }),
    actorRef: "test-human",
  });
}

async function createLead(organizationId: string, contactId: string) {
  return successfulCommand("POST", "/commercial/leads", {
    organizationId,
    contactId,
    source: "integration-test",
    actorRef: "test-human",
  });
}

const standardFacts = [
  ["company_ownership_type", "private"],
  ["has_existing_sales_process", true],
  ["uses_crm", true],
  ["seller_count", 3],
  ["commercial_owner_defined", true],
  ["has_recurring_inbound", true],
  ["monthly_lead_volume", 500],
  ["average_ticket_brl_cents", 500_000],
  ["measures_conversion", true],
  ["roi_provable_within_90_days", true],
  ["pain_confirmed", true],
  ["pain_recurring", true],
  ["pain_measurable", true],
] as const;

async function recordStandardFacts(
  organizationId: string,
  leadId: string,
  overrides: Partial<Record<(typeof standardFacts)[number][0], unknown>> = {},
): Promise<void> {
  for (const [factKey, defaultValue] of standardFacts) {
    const value = overrides[factKey] ?? defaultValue;
    await successfulCommand("POST", `/commercial/leads/${leadId}/facts`, {
      organizationId,
      factKey,
      factSchemaVersion: 1,
      value,
      sourceType: "human_declaration",
      sourceRef: "test-human",
      declarerRef: "test-human",
      executorRef: "integration-test",
      observedAt: "2026-08-11T12:00:00.000Z",
      ...(factKey.startsWith("pain_")
        ? {
            evidence: {
              type: "human_attestation",
              ref: "integration-standard-fit",
            },
          }
        : {}),
    });
  }
}

async function evaluateDecision(
  organizationId: string,
  leadId: string,
  requestedAction: CommercialRequestedAction,
  opportunityId?: string,
  human = false,
) {
  const humanReason: Partial<Record<CommercialRequestedAction, string>> = {
    create_opportunity: "conversion_measurement_gap",
    transition_to_qualified: "human_qualification_confirmed",
    transition_to_proposal: "proposal_authorized",
    transition_to_negotiation: "negotiation_started",
    transition_to_nurture: "nurture_timing_window_pending",
    transition_to_won: "commercial_agreement_confirmed",
    transition_to_lost: "other_human_confirmed",
    transition_to_disqualified: "crm_not_used",
  };
  const response = await commercialCommand(
    "POST",
    `/commercial/leads/${leadId}/decisions`,
    {
      organizationId,
      requestedAction,
      ...(opportunityId == null ? {} : { opportunityId }),
      authorityType: human ? "declared_human" : "policy",
      authorityRef: human
        ? "human:test"
        : requestedAction === "create_opportunity"
          ? "opportunity-eligibility@1.0.0"
          : "commercial-state-gates@1.0.0",
      executorRef: "integration-test",
      ...(human
        ? {
            reasonCode: humanReason[requestedAction],
            evidence: {
              type: "human_attestation",
              ref: "integration-human-decision",
            },
          }
        : {}),
    },
  );
  expect(response.statusCode).toBe(201);
  return commercialDecisionSchema.parse(response.json());
}

async function recordFact(
  organizationId: string,
  leadId: string,
  factKey: CommercialFactKey,
  value: unknown,
  options: {
    idempotencyKey?: string;
    correctsFactIds?: string[];
  } = {},
) {
  return successfulCommand(
    "POST",
    `/commercial/leads/${leadId}/facts`,
    {
      organizationId,
      factKey,
      factSchemaVersion: 1,
      value,
      sourceType: "human_declaration",
      sourceRef: "test-human",
      declarerRef: "test-human",
      executorRef: "integration-test",
      observedAt: "2026-08-11T12:00:00.000Z",
      ...(factKey.startsWith("pain_") || options.correctsFactIds != null
        ? {
            evidence: {
              type: "human_attestation",
              ref: "integration-fact-evidence",
            },
          }
        : {}),
      ...(options.correctsFactIds == null
        ? {}
        : {
            correctsFactIds: options.correctsFactIds,
            authorityType: "declared_human",
            authorityRef: "test-human",
          }),
    },
    options.idempotencyKey,
  );
}

describe("commercial domain foundation", () => {
  beforeAll(async () => {
    const result = await new Migrator({
      db: database,
      provider: migrationProvider,
    }).migrateToLatest();
    if (result.error != null) {
      throw result.error instanceof Error
        ? result.error
        : new Error("Commercial migration failed");
    }
  });

  afterAll(async () => {
    await api.close();
    await database.destroy();
  });

  it("persists the synchronous vertical slice, consolidated context and timeline", async () => {
    const organizationId = await createOrganization();
    const company = await successfulCommand("POST", "/commercial/companies", {
      organizationId,
      name: "Synthetic Company",
      domain: "HTTPS://EXAMPLE.TEST/",
      cnpj: "04.252.011/0001-10",
      actorRef: "test-human",
    });
    const contact = await createContact(organizationId);
    await successfulCommand(
      "PUT",
      `/commercial/contacts/${contact.targetId}/company`,
      { organizationId, companyId: company.targetId, actorRef: "test-human" },
    );
    const lead = await createLead(organizationId, contact.targetId!);
    await successfulCommand(
      "PUT",
      `/commercial/leads/${lead.targetId}/company`,
      { organizationId, companyId: company.targetId, actorRef: "test-human" },
    );
    await successfulCommand(
      "POST",
      `/commercial/leads/${lead.targetId}/assignments`,
      {
        organizationId,
        assigneeRef: "test-owner",
        actorRef: "test-human",
      },
    );
    const conversation = await successfulCommand(
      "POST",
      "/commercial/conversations",
      {
        organizationId,
        leadId: lead.targetId,
        channel: "web-form",
        externalNamespace: "test/account",
        actorRef: "test-human",
      },
    );
    await successfulCommand(
      "POST",
      `/commercial/conversations/${conversation.targetId}/messages`,
      {
        organizationId,
        body: "Synthetic inquiry",
        occurredAt: "2026-08-10T12:00:00.000Z",
        actorRef: "test-human",
      },
    );
    await recordStandardFacts(organizationId, lead.targetId!);
    const opportunityDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
    );
    const opportunity = await successfulCommand(
      "POST",
      "/commercial/opportunities",
      {
        organizationId,
        leadId: lead.targetId,
        decisionId: opportunityDecision.id,
        actorRef: "test-human",
      },
    );
    const discoveryDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_discovery",
      opportunity.targetId!,
    );
    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "discovery",
        reasonCode: "discovery_started",
        decisionId: discoveryDecision.id,
        actorRef: "test-human",
      },
    );

    const contextResponse = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/context?organizationId=${organizationId}`,
    });
    const timelineResponse = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/timeline?organizationId=${organizationId}&limit=100`,
    });
    const context = leadContextSchema.parse(contextResponse.json());
    const timeline = commercialTimelineSchema.parse(timelineResponse.json());
    const queryContracts = await Promise.all([
      api.inject({
        method: "GET",
        url: `/commercial/organizations/${organizationId}`,
      }),
      api.inject({
        method: "GET",
        url: `/commercial/companies/${company.targetId}?organizationId=${organizationId}`,
      }),
      api.inject({
        method: "GET",
        url: `/commercial/contacts/${contact.targetId}?organizationId=${organizationId}`,
      }),
      api.inject({
        method: "GET",
        url: `/commercial/leads/${lead.targetId}?organizationId=${organizationId}`,
      }),
      api.inject({
        method: "GET",
        url: `/commercial/conversations/${conversation.targetId}?organizationId=${organizationId}`,
      }),
      api.inject({
        method: "GET",
        url: `/commercial/opportunities/${opportunity.targetId}?organizationId=${organizationId}`,
      }),
    ]);
    organizationSchema.parse(queryContracts[0].json());
    companySchema.parse(queryContracts[1].json());
    contactSchema.parse(queryContracts[2].json());
    leadSchema.parse(queryContracts[3].json());
    conversationSchema.parse(queryContracts[4].json());
    opportunitySchema.parse(queryContracts[5].json());

    expect(context.contact.companyId).toBe(company.targetId);
    expect(context.lead.companyId).toBe(company.targetId);
    expect(context.lead.status).toBe("converted");
    expect(context.assignment?.assigneeRef).toBe("test-owner");
    expect(context.opportunity?.commercialState).toBe("discovery");
    expect(context.conversations[0]?.messages[0]?.sequence).toBe(1);
    const eventTypes = timeline.items.map((event) => event.eventType);
    expect(eventTypes.slice(0, 22)).toEqual([
      "company_created",
      "contact_created",
      "contact_linked",
      "lead_created",
      "lead_company_linked",
      "owner_assigned",
      "conversation_started",
      "message_received",
      ...Array.from(
        { length: standardFacts.length },
        () => "commercial_fact_recorded" as const,
      ),
      "commercial_decision_evaluated",
    ]);
    expect(eventTypes.slice(22, 24).sort()).toEqual(
      ["commercial_decision_applied", "opportunity_created"].sort(),
    );
    expect(eventTypes[24]).toBe("commercial_decision_evaluated");
    expect(eventTypes.slice(25, 27).sort()).toEqual(
      ["commercial_decision_applied", "state_changed"].sort(),
    );
  });

  it("round-trips commercial JSONB values without double encoding", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const lead = await createLead(organizationId, contact.targetId!);

    await recordFact(
      organizationId,
      lead.targetId!,
      "company_ownership_type",
      "private",
    );
    await recordFact(organizationId, lead.targetId!, "uses_crm", false);
    await recordFact(organizationId, lead.targetId!, "seller_count", 3);
    const decision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
    );

    const factRows = await database
      .selectFrom("commercialFacts")
      .select(["factKey", "value"])
      .where("organizationId", "=", organizationId)
      .where("leadId", "=", lead.targetId!)
      .execute();
    const factValues = Object.fromEntries(
      factRows.map((row) => [row.factKey, row.value]),
    );
    const decisionRow = await database
      .selectFrom("commercialDecisions")
      .select([
        "inputSnapshot",
        "eligibleActions",
        "blockedActions",
        "missingRequirements",
        "requiredEvidence",
        "reasonCodes",
      ])
      .where("organizationId", "=", organizationId)
      .where("id", "=", decision.id)
      .executeTakeFirstOrThrow();

    expect(factValues).toEqual({
      company_ownership_type: "private",
      uses_crm: false,
      seller_count: 3,
    });
    expect(decisionRow.inputSnapshot).toEqual(
      expect.objectContaining({ requestedAction: "create_opportunity" }),
    );
    expect(decisionRow.eligibleActions).toEqual([]);
    expect(decisionRow.blockedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "create_opportunity" }),
      ]),
    );
    expect(decisionRow.missingRequirements).toEqual(
      expect.arrayContaining(["has_existing_sales_process"]),
    );
    expect(decisionRow.requiredEvidence).toEqual([]);
    expect(decisionRow.reasonCodes).toEqual(
      expect.arrayContaining(["fact_unknown"]),
    );
    expect(typeof factValues.company_ownership_type).toBe("string");
    expect(Array.isArray(decisionRow.blockedActions)).toBe(true);
    expect(Array.isArray(decisionRow.missingRequirements)).toBe(true);
    expect(typeof decisionRow.inputSnapshot).toBe("object");
  });

  it("treats CNPJ as strong identity without merging ambiguous Company fields", async () => {
    const organizationId = await createOrganization();
    const first = await successfulCommand("POST", "/commercial/companies", {
      organizationId,
      name: "Repeated Name",
      domain: "same.example.test",
      cnpj: "04.252.011/0001-10",
      actorRef: "test-human",
    });
    const ambiguousDuplicate = await successfulCommand(
      "POST",
      "/commercial/companies",
      {
        organizationId,
        name: "Repeated Name",
        domain: "same.example.test",
        actorRef: "test-human",
      },
    );
    const strongConflict = await commercialCommand(
      "POST",
      "/commercial/companies",
      {
        organizationId,
        name: "Another Name",
        cnpj: "04252011000110",
        actorRef: "test-human",
      },
    );

    expect(ambiguousDuplicate.targetId).not.toBe(first.targetId);
    expect(strongConflict.statusCode).toBe(409);
    expect(apiErrorSchema.parse(strongConflict.json()).error.code).toBe(
      "COMPANY_CNPJ_CONFLICT",
    );
  });

  it("keeps Fact replay, conflict and complete-set correction deterministic", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const lead = await createLead(organizationId, contact.targetId!);
    const key = randomUUID();
    const first = await recordFact(
      organizationId,
      lead.targetId!,
      "measures_conversion",
      true,
      { idempotencyKey: key },
    );
    const replay = await recordFact(
      organizationId,
      lead.targetId!,
      "measures_conversion",
      true,
      { idempotencyKey: key },
    );
    expect(replay).toEqual(first);

    const conflict = await commercialCommand(
      "POST",
      `/commercial/leads/${lead.targetId}/facts`,
      {
        organizationId,
        factKey: "measures_conversion",
        factSchemaVersion: 1,
        value: false,
        sourceType: "human_declaration",
        sourceRef: "test-human",
        declarerRef: "test-human",
        executorRef: "integration-test",
        observedAt: "2026-08-11T12:00:00.000Z",
      },
      key,
    );
    expect(conflict.statusCode).toBe(409);

    const [second, third] = await Promise.all([
      recordFact(organizationId, lead.targetId!, "measures_conversion", false),
      recordFact(organizationId, lead.targetId!, "measures_conversion", true),
    ]);
    const conflictingResponse = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/facts?organizationId=${organizationId}`,
    });
    const conflicting = commercialFactSnapshotSchema
      .array()
      .parse(conflictingResponse.json());
    expect(conflicting).toMatchObject([
      {
        factKey: "measures_conversion",
        status: "conflicting",
        value: null,
      },
    ]);

    const partialCorrection = await commercialCommand(
      "POST",
      `/commercial/leads/${lead.targetId}/facts`,
      {
        organizationId,
        factKey: "measures_conversion",
        factSchemaVersion: 1,
        value: true,
        sourceType: "human_declaration",
        sourceRef: "test-human",
        declarerRef: "test-human",
        executorRef: "integration-test",
        observedAt: "2026-08-11T12:00:00.000Z",
        evidence: {
          type: "human_attestation",
          ref: "integration-partial-correction",
        },
        correctsFactIds: [first.targetId],
        authorityType: "declared_human",
        authorityRef: "test-human",
      },
    );
    expect(partialCorrection.statusCode).toBe(409);

    await recordFact(
      organizationId,
      lead.targetId!,
      "measures_conversion",
      true,
      {
        correctsFactIds: [second.targetId!, first.targetId!, third.targetId!],
      },
    );
    const correctedResponse = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/facts?organizationId=${organizationId}`,
    });
    const corrected = commercialFactSnapshotSchema
      .array()
      .parse(correctedResponse.json());
    expect(corrected).toMatchObject([
      {
        factKey: "measures_conversion",
        status: "consistent",
        value: true,
        facts: [
          {
            correctedFactIds: [
              first.targetId,
              second.targetId,
              third.targetId,
            ].sort(),
          },
        ],
      },
    ]);
    const historicalFacts = await database
      .selectFrom("commercialFacts")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("leadId", "=", lead.targetId!)
      .execute();
    const correctionLinks = await database
      .selectFrom("commercialFactCorrections")
      .select("correctedFactId")
      .where("organizationId", "=", organizationId)
      .execute();
    expect(historicalFacts).toHaveLength(4);
    expect(correctionLinks).toHaveLength(3);
  });

  it("separates missing information, human review and hard exclusions", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const lead = await createLead(organizationId, contact.targetId!);
    const missing = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
    );
    expect(missing.outcome).toBe("require_information");

    await recordStandardFacts(organizationId, lead.targetId!, {
      measures_conversion: false,
    });
    const review = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
    );
    expect(review.outcome).toBe("require_human_review");
    expect(review.reasonCodes).toContain("conversion_measurement_gap");
    const human = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
      undefined,
      true,
    );
    expect(human.outcome).toBe("allow");

    const excludedOrganizationId = await createOrganization();
    const excludedContact = await createContact(excludedOrganizationId);
    const excludedLead = await createLead(
      excludedOrganizationId,
      excludedContact.targetId!,
    );
    await recordStandardFacts(excludedOrganizationId, excludedLead.targetId!, {
      uses_crm: false,
    });
    const policyBlock = await evaluateDecision(
      excludedOrganizationId,
      excludedLead.targetId!,
      "create_opportunity",
    );
    const humanBlock = await evaluateDecision(
      excludedOrganizationId,
      excludedLead.targetId!,
      "create_opportunity",
      undefined,
      true,
    );
    expect(policyBlock.outcome).toBe("block");
    expect(humanBlock.outcome).toBe("block");
    expect(humanBlock.reasonCodes).toContain("crm_not_used");
  });

  it("rejects a Decision after the active Fact set changes", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const lead = await createLead(organizationId, contact.targetId!);
    await recordStandardFacts(organizationId, lead.targetId!);
    const decision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
    );
    expect(decision.outcome).toBe("allow");
    await recordFact(organizationId, lead.targetId!, "pain_confirmed", true);
    const stale = await commercialCommand("POST", "/commercial/opportunities", {
      organizationId,
      leadId: lead.targetId,
      decisionId: decision.id,
      actorRef: "test-human",
    });
    expect(stale.statusCode).toBe(409);
    expect(apiErrorSchema.parse(stale.json()).error.code).toBe(
      "DECISION_STALE",
    );
  });

  it("requires declared human authority for qualification and terminal actions", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const lead = await createLead(organizationId, contact.targetId!);
    await recordStandardFacts(organizationId, lead.targetId!);
    const creationDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
    );
    const opportunity = await successfulCommand(
      "POST",
      "/commercial/opportunities",
      {
        organizationId,
        leadId: lead.targetId,
        decisionId: creationDecision.id,
        actorRef: "test-human",
      },
    );
    const discoveryDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_discovery",
      opportunity.targetId!,
    );
    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "discovery",
        reasonCode: "discovery_started",
        decisionId: discoveryDecision.id,
        actorRef: "test-human",
      },
    );
    await Promise.all([
      recordFact(
        organizationId,
        lead.targetId!,
        "decision_maker_access_confirmed",
        true,
      ),
      recordFact(organizationId, lead.targetId!, "budget_confirmed", true),
      recordFact(
        organizationId,
        lead.targetId!,
        "operational_capacity_confirmed",
        true,
      ),
      recordFact(
        organizationId,
        lead.targetId!,
        "timing_status",
        "available_now",
      ),
    ]);

    const policyQualification = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_qualified",
      opportunity.targetId!,
    );
    expect(policyQualification.outcome).toBe("require_human_review");
    const humanQualification = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_qualified",
      opportunity.targetId!,
      true,
    );
    expect(humanQualification.outcome).toBe("allow");
    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "qualified",
        reasonCode: "human_qualification_confirmed",
        decisionId: humanQualification.id,
        actorRef: "test-human",
      },
    );

    const policyLost = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_lost",
      opportunity.targetId!,
    );
    expect(policyLost.outcome).toBe("require_human_review");
    const humanLost = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_lost",
      opportunity.targetId!,
      true,
    );
    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "lost",
        reasonCode: "other_human_confirmed",
        decisionId: humanLost.id,
        actorRef: "test-human",
      },
    );
    const persisted = await commercialService.getOpportunity(
      organizationId,
      opportunity.targetId!,
    );
    expect(persisted.commercialState).toBe("lost");
  });

  it("supports Contact and Lead without Company, multiple Leads and later explicit linkage", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const firstLead = await createLead(organizationId, contact.targetId!);
    const secondLead = await createLead(organizationId, contact.targetId!);
    const company = await successfulCommand("POST", "/commercial/companies", {
      organizationId,
      name: "Later Company",
      actorRef: "test-human",
    });

    const before = await commercialService.getLead(
      organizationId,
      firstLead.targetId!,
    );
    await successfulCommand(
      "PUT",
      `/commercial/leads/${firstLead.targetId}/company`,
      { organizationId, companyId: company.targetId, actorRef: "test-human" },
    );
    const [first, second, persistedContact] = await Promise.all([
      commercialService.getLead(organizationId, firstLead.targetId!),
      commercialService.getLead(organizationId, secondLead.targetId!),
      commercialService.getContact(organizationId, contact.targetId!),
    ]);

    expect(before.companyId).toBeNull();
    expect(first.companyId).toBe(company.targetId);
    expect(second.companyId).toBeNull();
    expect(persistedContact.companyId).toBeNull();
  });

  it("blocks cross-Organization relations and rolls back commands and events", async () => {
    const firstOrganizationId = await createOrganization("First");
    const secondOrganizationId = await createOrganization("Second");
    const foreignCompany = await successfulCommand(
      "POST",
      "/commercial/companies",
      {
        organizationId: secondOrganizationId,
        name: "Foreign Company",
        actorRef: "test-human",
      },
    );
    const before = await database
      .selectFrom("commercialEvents")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("organizationId", "=", firstOrganizationId)
      .executeTakeFirstOrThrow();

    const response = await commercialCommand("POST", "/commercial/contacts", {
      organizationId: firstOrganizationId,
      companyId: foreignCompany.targetId,
      name: "Invalid Contact",
      actorRef: "test-human",
    });
    const after = await database
      .selectFrom("commercialEvents")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("organizationId", "=", firstOrganizationId)
      .executeTakeFirstOrThrow();
    const commandCount = await database
      .selectFrom("commercialCommands")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("organizationId", "=", firstOrganizationId)
      .where("commandType", "=", "create_contact_v1")
      .executeTakeFirstOrThrow();

    expect(response.statusCode).toBe(404);
    expect(apiErrorSchema.parse(response.json()).error.code).toBe(
      "COMMERCIAL_RESOURCE_NOT_FOUND",
    );
    expect(Number(after.count)).toBe(Number(before.count));
    expect(Number(commandCount.count)).toBe(0);

    await expect(
      database
        .insertInto("contacts")
        .values({
          id: randomUUID(),
          organizationId: firstOrganizationId,
          companyId: foreignCompany.targetId,
          name: "Direct invalid relation",
          normalizedEmail: null,
          normalizedPhone: null,
        })
        .execute(),
    ).rejects.toThrow();
  });

  it("replays, conflicts and serializes idempotent commands in PostgreSQL", async () => {
    const organizationId = await createOrganization();
    const idempotencyKey = randomUUID();
    const payload = {
      organizationId,
      name: "Concurrent Company",
      actorRef: "test-human",
    };
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        commercialCommand(
          "POST",
          "/commercial/companies",
          payload,
          idempotencyKey,
        ),
      ),
    );
    const receipts = responses.map((response) =>
      commercialCommandReceiptSchema.parse(response.json()),
    );
    const conflict = await commercialCommand(
      "POST",
      "/commercial/companies",
      { ...payload, name: "Different Company" },
      idempotencyKey,
    );
    const eventCount = await database
      .selectFrom("commercialEvents")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("organizationId", "=", organizationId)
      .where("eventType", "=", "company_created")
      .executeTakeFirstOrThrow();

    expect(new Set(receipts.map((receipt) => receipt.commandId)).size).toBe(1);
    expect(new Set(receipts.map((receipt) => receipt.targetId)).size).toBe(1);
    expect(new Set(receipts.map((receipt) => receipt.eventId)).size).toBe(1);
    expect(conflict.statusCode).toBe(409);
    expect(Number(eventCount.count)).toBe(1);
  });

  it("deduplicates external identities and deterministically orders concurrent Messages", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const externalLead = {
      organizationId,
      contactId: contact.targetId,
      source: "external-form",
      externalNamespace: "form/account-1",
      externalId: "lead-42",
      actorRef: "test-human",
    };
    const firstLead = await successfulCommand(
      "POST",
      "/commercial/leads",
      externalLead,
    );
    const repeatedLead = await successfulCommand(
      "POST",
      "/commercial/leads",
      externalLead,
    );
    const collidedLead = await commercialCommand("POST", "/commercial/leads", {
      ...externalLead,
      contactId: (await createContact(organizationId)).targetId,
    });
    expect(repeatedLead.targetId).toBe(firstLead.targetId);
    expect(repeatedLead.eventId).toBeNull();
    expect(collidedLead.statusCode).toBe(409);

    const conversation = await successfulCommand(
      "POST",
      "/commercial/conversations",
      {
        organizationId,
        leadId: firstLead.targetId,
        channel: "synthetic",
        externalNamespace: "test/account-1",
        actorRef: "test-human",
      },
    );
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        successfulCommand(
          "POST",
          `/commercial/conversations/${conversation.targetId}/messages`,
          {
            organizationId,
            body: `Synthetic message ${index}`,
            occurredAt: new Date(
              1_700_000_000_000 - index * 1_000,
            ).toISOString(),
            externalNamespace: "test/account-1",
            externalId: `message-${index}`,
            actorRef: "test-human",
          },
        ),
      ),
    );
    const messages = await database
      .selectFrom("messages")
      .selectAll()
      .where("conversationId", "=", conversation.targetId!)
      .orderBy("sequence", "asc")
      .execute();
    const repeatedMessage = await successfulCommand(
      "POST",
      `/commercial/conversations/${conversation.targetId}/messages`,
      {
        organizationId,
        body: "Synthetic message 0",
        occurredAt: new Date(1_700_000_000_000).toISOString(),
        externalNamespace: "test/account-1",
        externalId: "message-0",
        actorRef: "test-human",
      },
    );

    expect(messages.map((message) => message.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(new Set(messages.map((message) => message.sequence)).size).toBe(8);
    expect(repeatedMessage.eventId).toBeNull();
  });

  it("preserves one active Assignment, one Opportunity and terminal state rules", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const lead = await createLead(organizationId, contact.targetId!);
    await Promise.all([
      successfulCommand(
        "POST",
        `/commercial/leads/${lead.targetId}/assignments`,
        {
          organizationId,
          assigneeRef: "owner-a",
          actorRef: "test-human",
        },
      ),
      successfulCommand(
        "POST",
        `/commercial/leads/${lead.targetId}/assignments`,
        {
          organizationId,
          assigneeRef: "owner-b",
          actorRef: "test-human",
        },
      ),
    ]);
    const activeAssignments = await database
      .selectFrom("leadAssignments")
      .selectAll()
      .where("leadId", "=", lead.targetId!)
      .where("endedAt", "is", null)
      .execute();
    const allAssignments = await database
      .selectFrom("leadAssignments")
      .selectAll()
      .where("leadId", "=", lead.targetId!)
      .execute();
    expect(activeAssignments).toHaveLength(1);
    expect(allAssignments).toHaveLength(2);

    await recordStandardFacts(organizationId, lead.targetId!);
    const opportunityDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "create_opportunity",
    );
    const opportunity = await successfulCommand(
      "POST",
      "/commercial/opportunities",
      {
        organizationId,
        leadId: lead.targetId,
        decisionId: opportunityDecision.id,
        actorRef: "test-human",
      },
    );
    const persistedLead = await commercialService.getLead(
      organizationId,
      lead.targetId!,
    );
    const secondOpportunity = await commercialCommand(
      "POST",
      "/commercial/opportunities",
      {
        organizationId,
        leadId: lead.targetId,
        decisionId: opportunityDecision.id,
        actorRef: "test-human",
      },
    );
    expect(persistedLead.status).toBe("converted");
    expect(secondOpportunity.statusCode).toBe(409);
    expect(apiErrorSchema.parse(secondOpportunity.json()).error.code).toBe(
      "DECISION_ALREADY_APPLIED",
    );

    const transitionKey = randomUUID();
    const discoveryDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_discovery",
      opportunity.targetId!,
    );
    const firstTransition = await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "discovery",
        reasonCode: "discovery_started",
        decisionId: discoveryDecision.id,
        actorRef: "test-human",
      },
      transitionKey,
    );
    const replayedTransition = await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "discovery",
        reasonCode: "discovery_started",
        decisionId: discoveryDecision.id,
        actorRef: "test-human",
      },
      transitionKey,
    );
    const invalidDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_proposal",
      opportunity.targetId!,
    );
    const invalid = await commercialCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "proposal",
        reasonCode: "proposal_authorized",
        decisionId: invalidDecision.id,
        actorRef: "test-human",
      },
    );
    const lostDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_lost",
      opportunity.targetId!,
      true,
    );
    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "lost",
        reasonCode: "other_human_confirmed",
        decisionId: lostDecision.id,
        actorRef: "test-human",
      },
    );
    const terminalDecision = await evaluateDecision(
      organizationId,
      lead.targetId!,
      "transition_to_nurture",
      opportunity.targetId!,
    );
    const terminalRegression = await commercialCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "nurture",
        reasonCode: "nurture_timing_window_pending",
        decisionId: terminalDecision.id,
        actorRef: "test-human",
      },
    );
    expect(invalid.statusCode).toBe(422);
    expect(terminalRegression.statusCode).toBe(422);
    expect(replayedTransition).toEqual(firstTransition);
  });

  it("enforces append-only Messages and Commercial Events in PostgreSQL", async () => {
    const organizationId = await createOrganization();
    const contact = await createContact(organizationId);
    const lead = await createLead(organizationId, contact.targetId!);
    const conversation = await successfulCommand(
      "POST",
      "/commercial/conversations",
      {
        organizationId,
        leadId: lead.targetId,
        channel: "synthetic",
        externalNamespace: "test/immutability",
        actorRef: "test-human",
      },
    );
    const message = await successfulCommand(
      "POST",
      `/commercial/conversations/${conversation.targetId}/messages`,
      {
        organizationId,
        body: "Immutable synthetic message",
        occurredAt: "2026-08-10T12:00:00.000Z",
        actorRef: "test-human",
      },
    );
    const event = await database
      .selectFrom("commercialEvents")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("eventType", "=", "message_received")
      .executeTakeFirstOrThrow();

    await expect(
      sql`update messages set body = 'rewritten' where id = ${message.targetId}`.execute(
        database,
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      sql`delete from commercial_events where id = ${event.id}`.execute(
        database,
      ),
    ).rejects.toThrow(/append-only/);
  });
});
