import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Migrator } from "kysely/migration";

import {
  CommercialDecisionRepository,
  CommercialInterpretationRepository,
  CommercialRepository,
  createDatabase,
  FoundationJobRepository,
  migrationProvider,
} from "@cognita/database";
import { createLogger } from "@cognita/observability";
import {
  commercialCommandReceiptSchema,
  commercialDecisionContextSchema,
  commercialDecisionSchema,
  commercialFactSnapshotSchema,
  interpretationRunSchema,
  questionCandidateSchema,
} from "@cognita/schemas";

import { FoundationJobService } from "../../apps/api/src/application/foundation-job-service.js";
import { CommercialInterpretationService } from "../../apps/api/src/commercial/commercial-interpretation-service.js";
import {
  FakeCommercialInterpretationProvider,
  interpretationInstructionMetadata,
  interpretationInvocationConfig,
  interpretationOutputSchemaMetadata,
} from "../../apps/api/src/commercial/commercial-interpretation-provider.js";
import { CommercialService } from "../../apps/api/src/commercial/commercial-service.js";
import { buildApi } from "../../apps/api/src/server.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl == null) throw new Error("DATABASE_URL is required");
const database = createDatabase({ connectionString: databaseUrl });
const logger = createLogger({
  service: "interpretation-integration",
  environment: "test",
  version: "test",
});
const decisionRepository = new CommercialDecisionRepository(database);
const commercialService = new CommercialService(
  new CommercialRepository(database),
  decisionRepository,
  logger,
);
const interpretationService = new CommercialInterpretationService(
  new CommercialInterpretationRepository(database),
  decisionRepository,
  new FakeCommercialInterpretationProvider(),
  logger,
);
const api = await buildApi({
  service: new FoundationJobService(new FoundationJobRepository(database), {
    publish: async () => undefined,
  }),
  commercialService,
  commercialInterpretationService: interpretationService,
  checkDatabase: async () => undefined,
  checkRedis: async () => undefined,
  logger,
});

const syntheticMessage =
  "Hoje entram uns 800 leads por mês, temos quatro vendedores e usamos HubSpot, mas não conseguimos medir direito quantos viram reunião.";

async function command(
  path: string,
  payload: Record<string, unknown>,
  key = randomUUID(),
) {
  return api.inject({
    method: "POST",
    url: path,
    headers: { "idempotency-key": key },
    payload,
  });
}

async function receipt(path: string, payload: Record<string, unknown>) {
  const response = await command(path, payload);
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  return commercialCommandReceiptSchema.parse(response.json());
}

describe("Commercial Intelligence vertical slice", () => {
  beforeAll(async () => {
    const migration = await new Migrator({
      db: database,
      provider: migrationProvider,
    }).migrateToLatest();
    expect(migration.error).toBeUndefined();
  });

  afterAll(async () => {
    await api.close();
    await database.destroy();
  });

  it("persists four Candidates, creates no Fact before review, then confirms Facts and updates Decision context", async () => {
    const organizationId = randomUUID();
    await receipt("/commercial/organizations", {
      organizationId,
      name: "Synthetic Intelligence Organization",
      actorRef: "human:synthetic",
    });
    const contact = await receipt("/commercial/contacts", {
      organizationId,
      name: "Synthetic Contact",
      email: "synthetic-intelligence@example.test",
      actorRef: "human:synthetic",
    });
    const lead = await receipt("/commercial/leads", {
      organizationId,
      contactId: contact.targetId,
      source: "synthetic-integration",
      actorRef: "human:synthetic",
    });
    const conversation = await receipt("/commercial/conversations", {
      organizationId,
      leadId: lead.targetId,
      channel: "synthetic",
      externalNamespace: "synthetic-integration",
      actorRef: "human:synthetic",
    });
    const message = await receipt(
      `/commercial/conversations/${conversation.targetId}/messages`,
      {
        organizationId,
        body: syntheticMessage,
        occurredAt: "2026-08-12T20:00:00.000Z",
        actorRef: "human:synthetic",
      },
    );

    const interpretationRepository = new CommercialInterpretationRepository(
      database,
    );
    const protectedRunId = randomUUID();
    await interpretationRepository.start({
      id: protectedRunId,
      organizationId,
      messageId: message.targetId!,
      idempotencyKey: randomUUID(),
      requestHash: "a".repeat(64),
      executorRef: "api:synthetic",
      providerId: "openai",
      modelId: "gpt-5.6-terra",
      instructionKey: interpretationInstructionMetadata.key,
      instructionVersion: interpretationInstructionMetadata.version,
      instructionDigest: interpretationInstructionMetadata.digest,
      outputSchemaVersion: 1,
      outputSchemaDigest: interpretationOutputSchemaMetadata.digest,
      invocationConfig: interpretationInvocationConfig,
      reprocessesRunId: null,
    });
    await expect(
      database
        .updateTable("commercialInterpretationRuns")
        .set({
          status: "failed",
          instructionVersion: "tampered",
          failureCode: "provider_error",
          failedAt: new Date(),
        })
        .where("id", "=", protectedRunId)
        .execute(),
    ).rejects.toThrow("identity and baseline are immutable");
    await interpretationRepository.fail(
      organizationId,
      protectedRunId,
      "api:synthetic",
      "provider_error",
    );
    await expect(
      database
        .deleteFrom("commercialInterpretationRuns")
        .where("id", "=", protectedRunId)
        .execute(),
    ).rejects.toThrow("append-only");

    const startKey = randomUUID();
    const interpreted = await command(
      `/commercial/messages/${message.targetId}/interpretations`,
      {
        organizationId,
        executorRef: "api:synthetic",
      },
      startKey,
    );
    expect(interpreted.statusCode).toBe(200);
    const run = interpretationRunSchema.parse(interpreted.json());
    expect(run.status).toBe("completed");
    expect(run.candidates).toHaveLength(4);
    expect(
      run.candidates.every(
        (candidate) => candidate.status === "pending_confirmation",
      ),
    ).toBe(true);
    expect(
      run.candidates.every((candidate) => candidate.evidence != null),
    ).toBe(true);

    const replay = await command(
      `/commercial/messages/${message.targetId}/interpretations`,
      {
        organizationId,
        executorRef: "api:synthetic",
      },
      startKey,
    );
    expect(interpretationRunSchema.parse(replay.json()).id).toBe(run.id);

    const beforeFacts = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/facts?organizationId=${organizationId}`,
    });
    expect(
      commercialFactSnapshotSchema.array().parse(beforeFacts.json()),
    ).toEqual([]);

    const firstCandidate = run.candidates[0]!;
    const crossOrganizationConfirmation = await command(
      `/commercial/fact-candidates/${firstCandidate.id}/confirm`,
      {
        organizationId: randomUUID(),
        authorityType: "declared_human",
        authorityRef: "human:synthetic",
        executorRef: "api:synthetic",
        mode: "assert",
        correctsFactIds: [],
      },
    );
    expect(crossOrganizationConfirmation.statusCode).toBe(404);

    const concurrentConfirmationKey = randomUUID();
    const unrelatedCommandWithSameKey = await command(
      "/commercial/contacts",
      {
        organizationId,
        name: "Synthetic idempotency namespace",
        email: "synthetic-idempotency-namespace@example.test",
        actorRef: "human:synthetic",
      },
      concurrentConfirmationKey,
    );
    expect(unrelatedCommandWithSameKey.statusCode).toBe(201);
    const concurrentConfirmations = await Promise.all([
      command(
        `/commercial/fact-candidates/${firstCandidate.id}/confirm`,
        {
          organizationId,
          authorityType: "declared_human",
          authorityRef: "human:synthetic",
          executorRef: "api:synthetic",
          mode: "assert",
          correctsFactIds: [],
        },
        concurrentConfirmationKey,
      ),
      command(
        `/commercial/fact-candidates/${firstCandidate.id}/confirm`,
        {
          organizationId,
          authorityType: "declared_human",
          authorityRef: "human:synthetic",
          executorRef: "api:synthetic",
          mode: "assert",
          correctsFactIds: [],
        },
        concurrentConfirmationKey,
      ),
    ]);
    expect(
      concurrentConfirmations.map((response) => response.statusCode),
    ).toEqual([200, 200]);

    for (const candidate of run.candidates.slice(1)) {
      const confirmed = await command(
        `/commercial/fact-candidates/${candidate.id}/confirm`,
        {
          organizationId,
          authorityType: "declared_human",
          authorityRef: "human:synthetic",
          executorRef: "api:synthetic",
          mode: "assert",
          correctsFactIds: [],
        },
      );
      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json()).toMatchObject({
        id: candidate.id,
        status: "confirmed",
      });
    }

    const facts = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/facts?organizationId=${organizationId}`,
    });
    const snapshots = commercialFactSnapshotSchema.array().parse(facts.json());
    expect(snapshots).toHaveLength(4);
    expect(snapshots.map((snapshot) => snapshot.factKey).sort()).toEqual([
      "measures_conversion",
      "monthly_lead_volume",
      "seller_count",
      "uses_crm",
    ]);

    const remainingFacts = [
      ["company_ownership_type", "private"],
      ["has_existing_sales_process", true],
      ["commercial_owner_defined", true],
      ["has_recurring_inbound", true],
      ["average_ticket_brl_cents", 500_000],
      ["roi_provable_within_90_days", true],
      ["pain_confirmed", true],
      ["pain_recurring", true],
      ["pain_measurable", true],
    ] as const;
    for (const [factKey, value] of remainingFacts) {
      const payload: Record<string, unknown> = {
        organizationId,
        factKey,
        factSchemaVersion: 1,
        value,
        sourceType: "human_declaration",
        sourceRef: "synthetic-setup",
        declarerRef: "human:synthetic",
        executorRef: "api:synthetic",
        observedAt: "2026-08-12T20:00:00.000Z",
      };
      if (factKey.startsWith("pain_"))
        payload.evidence = { type: "human_attestation", ref: "synthetic-pain" };
      await receipt(`/commercial/leads/${lead.targetId}/facts`, payload);
    }
    const decisionResponse = await command(
      `/commercial/leads/${lead.targetId}/decisions`,
      {
        organizationId,
        requestedAction: "create_opportunity",
        authorityType: "policy",
        authorityRef: "opportunity-eligibility@1.0.0",
        executorRef: "api:synthetic",
      },
    );
    const decision = commercialDecisionSchema.parse(decisionResponse.json());
    expect(decision.outcome).toBe("require_human_review");
    expect(decision.reasonCodes).toContain("conversion_measurement_gap");
    const context = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/decision-context?organizationId=${organizationId}`,
    });
    expect(
      commercialDecisionContextSchema.parse(context.json()).latestDecision?.id,
    ).toBe(decision.id);

    const reprocessed = await command(
      `/commercial/messages/${message.targetId}/interpretations`,
      {
        organizationId,
        executorRef: "api:synthetic",
        reprocessesRunId: run.id,
      },
    );
    const duplicateRun = interpretationRunSchema.parse(reprocessed.json());
    expect(duplicateRun.candidates).toHaveLength(4);
    expect(
      duplicateRun.candidates.every(
        (candidate) =>
          candidate.classification === "duplicate" &&
          candidate.duplicateOfCandidateId != null,
      ),
    ).toBe(true);
  });

  it("persists deterministic invalid Evidence and failed runs without partial Candidates", async () => {
    const organizationId = randomUUID();
    await receipt("/commercial/organizations", {
      organizationId,
      name: "Synthetic Failure Organization",
      actorRef: "human:synthetic",
    });
    const contact = await receipt("/commercial/contacts", {
      organizationId,
      name: "Synthetic Failure Contact",
      email: "synthetic-failure@example.test",
      actorRef: "human:synthetic",
    });
    const lead = await receipt("/commercial/leads", {
      organizationId,
      contactId: contact.targetId,
      source: "synthetic-failure",
      actorRef: "human:synthetic",
    });
    const conversation = await receipt("/commercial/conversations", {
      organizationId,
      leadId: lead.targetId,
      channel: "synthetic",
      externalNamespace: "synthetic-failure",
      actorRef: "human:synthetic",
    });
    const message = await receipt(
      `/commercial/conversations/${conversation.targetId}/messages`,
      {
        organizationId,
        body: "Temos quatro vendedores.",
        occurredAt: "2026-08-12T20:00:00.000Z",
        actorRef: "human:synthetic",
      },
    );
    const invalidEvidenceService = new CommercialInterpretationService(
      new CommercialInterpretationRepository(database),
      decisionRepository,
      {
        interpret: async () => ({
          output: {
            candidates: [
              {
                factKey: "seller_count",
                proposedValue: 4,
                classification: "reviewable",
                ambiguityCode: null,
                ambiguityDetails: null,
                evidenceQuote: "quote inexistente",
              },
            ],
          },
          returnedModelId: "gpt-5.6-terra",
          providerRequestId: "synthetic-invalid-evidence",
          durationMs: 1,
          inputTokens: null,
          outputTokens: null,
        }),
      },
      logger,
    );
    const invalidEvidenceRun = await invalidEvidenceService.start(
      message.targetId!,
      { organizationId, executorRef: "api:synthetic" },
      randomUUID(),
      randomUUID(),
    );
    expect(invalidEvidenceRun.status).toBe("completed");
    expect(invalidEvidenceRun.candidates[0]).toMatchObject({
      classification: "invalid",
      validationCode: "evidence_quote_not_found",
      evidence: null,
    });

    const failedService = new CommercialInterpretationService(
      new CommercialInterpretationRepository(database),
      decisionRepository,
      {
        interpret: () =>
          Promise.reject(new SyntaxError("synthetic invalid output")),
      },
      logger,
    );
    const failedRun = await failedService.start(
      message.targetId!,
      { organizationId, executorRef: "api:synthetic" },
      randomUUID(),
      randomUUID(),
    );
    expect(failedRun).toMatchObject({
      status: "failed",
      failureCode: "invalid_structured_output",
      candidates: [],
    });

    const timedOutService = new CommercialInterpretationService(
      new CommercialInterpretationRepository(database),
      decisionRepository,
      {
        interpret: () =>
          Promise.reject(new DOMException("synthetic timeout", "TimeoutError")),
      },
      logger,
    );
    const timedOutRun = await timedOutService.start(
      message.targetId!,
      { organizationId, executorRef: "api:synthetic" },
      randomUUID(),
      randomUUID(),
    );
    expect(timedOutRun).toMatchObject({
      status: "failed",
      failureCode: "provider_timeout",
      candidates: [],
    });
  });

  it("uses a reviewed Candidate to correct the complete active Fact set", async () => {
    const organizationId = randomUUID();
    await receipt("/commercial/organizations", {
      organizationId,
      name: "Synthetic Correction Organization",
      actorRef: "human:synthetic",
    });
    const contact = await receipt("/commercial/contacts", {
      organizationId,
      name: "Synthetic Correction Contact",
      email: "synthetic-correction@example.test",
      actorRef: "human:synthetic",
    });
    const lead = await receipt("/commercial/leads", {
      organizationId,
      contactId: contact.targetId,
      source: "synthetic-correction",
      actorRef: "human:synthetic",
    });
    const conversation = await receipt("/commercial/conversations", {
      organizationId,
      leadId: lead.targetId,
      channel: "synthetic",
      externalNamespace: "synthetic-correction",
      actorRef: "human:synthetic",
    });
    const correctionService = new CommercialInterpretationService(
      new CommercialInterpretationRepository(database),
      decisionRepository,
      {
        interpret: async (messageBody) => {
          const corrected = messageBody.includes("três");
          return {
            output: {
              candidates: [
                {
                  factKey: "seller_count",
                  proposedValue: corrected ? 3 : 4,
                  classification: "reviewable" as const,
                  ambiguityCode: null,
                  ambiguityDetails: null,
                  evidenceQuote: corrected
                    ? "Agora temos três vendedores."
                    : "Temos quatro vendedores.",
                },
              ],
            },
            returnedModelId: "gpt-5.6-terra",
            providerRequestId: `synthetic-correction-${corrected ? "new" : "old"}`,
            durationMs: 1,
            inputTokens: null,
            outputTokens: null,
          };
        },
      },
      logger,
    );
    const interpretAndGetCandidate = async (body: string) => {
      const message = await receipt(
        `/commercial/conversations/${conversation.targetId}/messages`,
        {
          organizationId,
          body,
          occurredAt: new Date().toISOString(),
          actorRef: "human:synthetic",
        },
      );
      const run = await correctionService.start(
        message.targetId!,
        { organizationId, executorRef: "api:synthetic" },
        randomUUID(),
        randomUUID(),
      );
      return run.candidates[0]!;
    };

    const originalCandidate = await interpretAndGetCandidate(
      "Temos quatro vendedores.",
    );
    await correctionService.confirm(
      originalCandidate.id,
      {
        organizationId,
        authorityType: "declared_human",
        authorityRef: "human:synthetic",
        executorRef: "api:synthetic",
        mode: "assert",
        correctsFactIds: [],
      },
      randomUUID(),
    );
    const originalFactsResponse = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/facts?organizationId=${organizationId}`,
    });
    const originalSnapshot = commercialFactSnapshotSchema
      .array()
      .parse(originalFactsResponse.json())[0]!;
    const originalFactId = originalSnapshot.facts[0]!.id;

    const correctiveCandidate = await interpretAndGetCandidate(
      "Agora temos três vendedores.",
    );
    await correctionService.confirm(
      correctiveCandidate.id,
      {
        organizationId,
        authorityType: "declared_human",
        authorityRef: "human:synthetic",
        executorRef: "api:synthetic",
        mode: "correct",
        correctsFactIds: [originalFactId],
      },
      randomUUID(),
    );
    const correctedFactsResponse = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/facts?organizationId=${organizationId}`,
    });
    const correctedSnapshot = commercialFactSnapshotSchema
      .array()
      .parse(correctedFactsResponse.json())[0]!;
    expect(correctedSnapshot).toMatchObject({
      factKey: "seller_count",
      status: "consistent",
      value: 3,
    });
    expect(correctedSnapshot.facts).toHaveLength(1);
    expect(correctedSnapshot.facts[0]!.correctedFactIds).toEqual([
      originalFactId,
    ]);
  });

  it("projects the canonical ownership Question Candidate without persisting it", async () => {
    const organizationId = randomUUID();
    await receipt("/commercial/organizations", {
      organizationId,
      name: "Synthetic Questions",
      actorRef: "human:synthetic",
    });
    const contact = await receipt("/commercial/contacts", {
      organizationId,
      name: "Synthetic Contact",
      email: "synthetic-questions@example.test",
      actorRef: "human:synthetic",
    });
    const lead = await receipt("/commercial/leads", {
      organizationId,
      contactId: contact.targetId,
      source: "synthetic-question",
      actorRef: "human:synthetic",
    });
    const decisionResponse = await command(
      `/commercial/leads/${lead.targetId}/decisions`,
      {
        organizationId,
        requestedAction: "create_opportunity",
        authorityType: "policy",
        authorityRef: "opportunity-eligibility@1.0.0",
        executorRef: "api:synthetic",
      },
    );
    expect(decisionResponse.statusCode).toBe(201);
    const questionsResponse = await api.inject({
      method: "GET",
      url: `/commercial/leads/${lead.targetId}/question-candidates?organizationId=${organizationId}`,
    });
    const questions = questionCandidateSchema
      .array()
      .parse(questionsResponse.json());
    expect(questions).toContainEqual(
      expect.objectContaining({
        requirementId: "company_ownership_type_known",
        text: "Qual é o tipo de propriedade da empresa?",
      }),
    );
    expect(questions.map((question) => question.requirementId)).not.toContain(
      "company_ownership_type",
    );
  });
});
