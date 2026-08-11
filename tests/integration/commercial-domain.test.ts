import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { Migrator } from "kysely/migration";

import {
  CommercialRepository,
  createDatabase,
  FoundationJobRepository,
  migrationProvider,
} from "@cognita/database";
import { createLogger } from "@cognita/observability";
import {
  apiErrorSchema,
  commercialCommandReceiptSchema,
  commercialTimelineSchema,
  companySchema,
  contactSchema,
  conversationSchema,
  leadContextSchema,
  leadSchema,
  opportunitySchema,
  organizationSchema,
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
  idempotencyKey = randomUUID(),
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
  idempotencyKey = randomUUID(),
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
    const opportunity = await successfulCommand(
      "POST",
      "/commercial/opportunities",
      { organizationId, leadId: lead.targetId, actorRef: "test-human" },
    );
    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "discovery",
        reasonCode: "human_review_started",
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
    expect(timeline.items.map((event) => event.eventType)).toEqual([
      "company_created",
      "contact_created",
      "contact_linked",
      "lead_created",
      "lead_company_linked",
      "owner_assigned",
      "conversation_started",
      "message_received",
      "opportunity_created",
      "state_changed",
    ]);
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

    const opportunity = await successfulCommand(
      "POST",
      "/commercial/opportunities",
      { organizationId, leadId: lead.targetId, actorRef: "test-human" },
    );
    const persistedLead = await commercialService.getLead(
      organizationId,
      lead.targetId!,
    );
    const secondOpportunity = await commercialCommand(
      "POST",
      "/commercial/opportunities",
      { organizationId, leadId: lead.targetId, actorRef: "test-human" },
    );
    expect(persistedLead.status).toBe("converted");
    expect(secondOpportunity.statusCode).toBe(422);

    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "discovery",
        reasonCode: "started",
        actorRef: "test-human",
      },
    );
    const invalid = await commercialCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "proposal",
        reasonCode: "skipped",
        actorRef: "test-human",
      },
    );
    await successfulCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "lost",
        reasonCode: "human_decision",
        actorRef: "test-human",
      },
    );
    const terminalRegression = await commercialCommand(
      "POST",
      `/commercial/opportunities/${opportunity.targetId}/transitions`,
      {
        organizationId,
        toState: "nurture",
        reasonCode: "regression",
        actorRef: "test-human",
      },
    );
    expect(invalid.statusCode).toBe(422);
    expect(terminalRegression.statusCode).toBe(422);
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
