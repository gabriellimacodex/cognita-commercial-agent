import { randomUUID } from "node:crypto";

import type {
  CommercialFactKey,
  FactCandidate,
  InterpretationRun,
} from "@cognita/schemas";
import { type Kysely, sql, type Transaction } from "kysely";

import {
  CommercialConflictError,
  CommercialIdempotencyConflictError,
  CommercialNotFoundError,
} from "./commercial-repository.js";
import { serializeJsonb } from "./jsonb.js";
import type {
  CommercialFactCandidateRow,
  CommercialInterpretationRunRow,
  DatabaseSchema,
} from "./schema.js";

export interface StartInterpretationRecord {
  id: string;
  organizationId: string;
  messageId: string;
  idempotencyKey: string;
  requestHash: string;
  executorRef: string;
  providerId: "openai";
  modelId: "gpt-5.6-terra";
  instructionKey: string;
  instructionVersion: string;
  instructionDigest: string;
  outputSchemaVersion: 1;
  outputSchemaDigest: string;
  invocationConfig: {
    endpoint: "https://api.openai.com/v1/responses";
    reasoningEffort: "none";
    maxOutputTokens: 1200;
    store: false;
    background: false;
    tools: false;
    timeoutMs: 20000;
    automaticRetries: 0;
    fallback: false;
  };
  reprocessesRunId: string | null;
}

export interface PersistedInterpretationStart {
  run: InterpretationRun;
  messageBody: string;
  replayed: boolean;
}

export interface CandidateRecord {
  id: string;
  factKey: CommercialFactKey;
  factSchemaVersion: 1;
  valueType: "boolean" | "integer" | "string" | "timestamp" | null;
  proposedValue: boolean | number | string | null;
  classification: "reviewable" | "ambiguous" | "invalid";
  ambiguityCode:
    | "numeric_range"
    | "uncertain_language"
    | "multiple_possible_values"
    | "unclear_negation"
    | "insufficient_context"
    | null;
  ambiguityDetails: {
    minimum: number | null;
    maximum: number | null;
    note: string | null;
  } | null;
  validationCode: string | null;
  evidence: {
    id: string;
    startOffset: number;
    endOffset: number;
    spanDigest: string;
  } | null;
}

export interface CompleteInterpretationRecord {
  returnedModelId: "gpt-5.6-terra";
  providerRequestId: string | null;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  outputDigest: string;
  candidates: CandidateRecord[];
}

export interface ConfirmCandidateRecord {
  organizationId: string;
  candidateId: string;
  commandId: string;
  idempotencyKey: string;
  requestHash: string;
  authorityRef: string;
  executorRef: string;
  mode: "assert" | "correct";
  correctsFactIds: string[];
  valueType: "boolean" | "integer" | "string" | "timestamp";
}

export interface RejectCandidateRecord {
  organizationId: string;
  candidateId: string;
  commandId: string;
  idempotencyKey: string;
  requestHash: string;
  authorityRef: string;
  executorRef: string;
  reasonCode: string;
}

function iso(value: Date): string {
  return value.toISOString();
}

export class CommercialInterpretationRepository {
  public constructor(private readonly database: Kysely<DatabaseSchema>) {}

  public async start(
    record: StartInterpretationRecord,
  ): Promise<PersistedInterpretationStart> {
    return this.database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom("commercialInterpretationRuns")
        .selectAll()
        .where("organizationId", "=", record.organizationId)
        .where("idempotencyKey", "=", record.idempotencyKey)
        .executeTakeFirst();
      if (existing != null) {
        if (existing.requestHash !== record.requestHash) {
          throw new CommercialIdempotencyConflictError();
        }
        const message = await transaction
          .selectFrom("messages")
          .select("body")
          .where("organizationId", "=", record.organizationId)
          .where("id", "=", existing.messageId)
          .executeTakeFirstOrThrow();
        return {
          run: await this.serializeRun(existing),
          messageBody: message.body,
          replayed: true,
        };
      }

      const message = await transaction
        .selectFrom("messages")
        .innerJoin("conversations", (join) =>
          join
            .onRef(
              "conversations.organizationId",
              "=",
              "messages.organizationId",
            )
            .onRef("conversations.id", "=", "messages.conversationId"),
        )
        .select([
          "messages.body",
          "messages.conversationId",
          "conversations.leadId",
        ])
        .where("messages.organizationId", "=", record.organizationId)
        .where("messages.id", "=", record.messageId)
        .executeTakeFirst();
      if (message == null) throw new CommercialNotFoundError("Message");
      if (record.reprocessesRunId != null) {
        const source = await transaction
          .selectFrom("commercialInterpretationRuns")
          .select("id")
          .where("organizationId", "=", record.organizationId)
          .where("id", "=", record.reprocessesRunId)
          .where("messageId", "=", record.messageId)
          .executeTakeFirst();
        if (source == null)
          throw new CommercialNotFoundError("Interpretation Run");
      }
      const row = await transaction
        .insertInto("commercialInterpretationRuns")
        .values({
          id: record.id,
          organizationId: record.organizationId,
          leadId: message.leadId,
          conversationId: message.conversationId,
          messageId: record.messageId,
          idempotencyKey: record.idempotencyKey,
          requestHash: record.requestHash,
          providerId: record.providerId,
          modelId: record.modelId,
          returnedModelId: null,
          instructionKey: record.instructionKey,
          instructionVersion: record.instructionVersion,
          instructionDigest: record.instructionDigest,
          outputSchemaVersion: record.outputSchemaVersion,
          outputSchemaDigest: record.outputSchemaDigest,
          invocationConfig: serializeJsonb(record.invocationConfig),
          providerRequestId: null,
          durationMs: null,
          inputTokens: null,
          outputTokens: null,
          outputDigest: null,
          failureCode: null,
          reprocessesRunId: record.reprocessesRunId,
          completedAt: null,
          failedAt: null,
        })
        .onConflict((conflict) =>
          conflict.columns(["organizationId", "idempotencyKey"]).doNothing(),
        )
        .returningAll()
        .executeTakeFirst();
      if (row == null) {
        const concurrent = await transaction
          .selectFrom("commercialInterpretationRuns")
          .selectAll()
          .where("organizationId", "=", record.organizationId)
          .where("idempotencyKey", "=", record.idempotencyKey)
          .executeTakeFirstOrThrow();
        if (concurrent.requestHash !== record.requestHash) {
          throw new CommercialIdempotencyConflictError();
        }
        return {
          run: await this.serializeRun(concurrent),
          messageBody: message.body,
          replayed: true,
        };
      }
      await this.insertEvent(
        transaction,
        row,
        "commercial_interpretation_started",
        record.executorRef,
        { runId: row.id },
      );
      return {
        run: await this.serializeRun(row),
        messageBody: message.body,
        replayed: false,
      };
    });
  }

  public async complete(
    organizationId: string,
    runId: string,
    executorRef: string,
    completion: CompleteInterpretationRecord,
  ): Promise<InterpretationRun> {
    await this.database.transaction().execute(async (transaction) => {
      const run = await transaction
        .selectFrom("commercialInterpretationRuns")
        .selectAll()
        .where("organizationId", "=", organizationId)
        .where("id", "=", runId)
        .forUpdate()
        .executeTakeFirst();
      if (run == null) throw new CommercialNotFoundError("Interpretation Run");
      if (run.status !== "running") return;

      for (const record of completion.candidates) {
        let classification: CommercialFactCandidateRow["classification"] =
          record.classification;
        let duplicateOfCandidateId: string | null = null;
        if (record.classification !== "invalid" && record.evidence != null) {
          const duplicateRows = await transaction
            .selectFrom("commercialFactCandidates")
            .innerJoin(
              "commercialEvidenceSpans",
              "commercialEvidenceSpans.candidateId",
              "commercialFactCandidates.id",
            )
            .select([
              "commercialFactCandidates.id",
              "commercialFactCandidates.proposedValue",
            ])
            .where(
              "commercialFactCandidates.organizationId",
              "=",
              organizationId,
            )
            .where("commercialFactCandidates.leadId", "=", run.leadId)
            .where("commercialFactCandidates.factKey", "=", record.factKey)
            .where("commercialFactCandidates.factSchemaVersion", "=", 1)
            .where(
              "commercialEvidenceSpans.spanDigest",
              "=",
              record.evidence.spanDigest,
            )
            .orderBy("commercialFactCandidates.createdAt", "asc")
            .orderBy("commercialFactCandidates.id", "asc")
            .execute();
          const duplicate = duplicateRows.find(
            (candidate) =>
              JSON.stringify(candidate.proposedValue) ===
              JSON.stringify(record.proposedValue),
          );
          if (duplicate != null) {
            classification = "duplicate";
            duplicateOfCandidateId = duplicate.id;
          }
        }
        await transaction
          .insertInto("commercialFactCandidates")
          .values({
            id: record.id,
            organizationId,
            leadId: run.leadId,
            interpretationRunId: run.id,
            messageId: run.messageId,
            factKey: record.factKey,
            factSchemaVersion: 1,
            valueType: record.valueType,
            proposedValue:
              record.proposedValue == null
                ? null
                : serializeJsonb(record.proposedValue),
            classification,
            ambiguityCode: record.ambiguityCode,
            ambiguityDetails:
              record.ambiguityDetails == null
                ? null
                : serializeJsonb(record.ambiguityDetails),
            validationCode: record.validationCode,
            duplicateOfCandidateId,
          })
          .execute();
        if (record.evidence != null) {
          await transaction
            .insertInto("commercialEvidenceSpans")
            .values({
              id: record.evidence.id,
              organizationId,
              candidateId: record.id,
              messageId: run.messageId,
              evidenceType: "message_text_span",
              startOffset: record.evidence.startOffset,
              endOffset: record.evidence.endOffset,
              spanDigest: record.evidence.spanDigest,
            })
            .execute();
        }
        await this.insertEvent(
          transaction,
          run,
          "commercial_fact_candidate_created",
          executorRef,
          {
            candidateId: record.id,
            factKey: record.factKey,
            classification,
          },
        );
      }
      await transaction
        .updateTable("commercialInterpretationRuns")
        .set({
          status: "completed",
          returnedModelId: completion.returnedModelId,
          providerRequestId: completion.providerRequestId,
          durationMs: completion.durationMs,
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
          outputDigest: completion.outputDigest,
          completedAt: new Date(),
        })
        .where("id", "=", run.id)
        .where("status", "=", "running")
        .execute();
      await this.insertEvent(
        transaction,
        run,
        "commercial_interpretation_completed",
        executorRef,
        {
          runId: run.id,
          candidateCount: completion.candidates.length,
          durationMs: completion.durationMs,
        },
      );
    });
    return this.get(organizationId, runId);
  }

  public async fail(
    organizationId: string,
    runId: string,
    executorRef: string,
    failureCode:
      "provider_timeout" | "provider_error" | "invalid_structured_output",
  ): Promise<InterpretationRun> {
    await this.database.transaction().execute(async (transaction) => {
      const run = await transaction
        .selectFrom("commercialInterpretationRuns")
        .selectAll()
        .where("organizationId", "=", organizationId)
        .where("id", "=", runId)
        .forUpdate()
        .executeTakeFirst();
      if (run == null) throw new CommercialNotFoundError("Interpretation Run");
      if (run.status !== "running") return;
      await transaction
        .updateTable("commercialInterpretationRuns")
        .set({
          status: "failed",
          failureCode,
          failedAt: new Date(),
        })
        .where("id", "=", run.id)
        .where("status", "=", "running")
        .execute();
      await this.insertEvent(
        transaction,
        run,
        "commercial_interpretation_failed",
        executorRef,
        {
          runId: run.id,
          failureCode,
        },
      );
    });
    return this.get(organizationId, runId);
  }

  public async get(
    organizationId: string,
    runId: string,
  ): Promise<InterpretationRun> {
    const row = await this.database
      .selectFrom("commercialInterpretationRuns")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", runId)
      .executeTakeFirst();
    if (row == null) throw new CommercialNotFoundError("Interpretation Run");
    return this.serializeRun(row);
  }

  public async listForMessage(
    organizationId: string,
    messageId: string,
  ): Promise<InterpretationRun[]> {
    const rows = await this.database
      .selectFrom("commercialInterpretationRuns")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("messageId", "=", messageId)
      .orderBy("startedAt", "desc")
      .orderBy("id", "desc")
      .execute();
    return Promise.all(rows.map((row) => this.serializeRun(row)));
  }

  public async confirm(record: ConfirmCandidateRecord): Promise<FactCandidate> {
    await this.database.transaction().execute(async (transaction) => {
      const replay = await this.loadCommandReplay(transaction, record);
      if (replay) return;
      const candidate = await this.requireReviewableCandidate(
        transaction,
        record.organizationId,
        record.candidateId,
      );
      const activeRows = await transaction
        .selectFrom("commercialFacts")
        .select("id")
        .where("organizationId", "=", record.organizationId)
        .where("leadId", "=", candidate.leadId)
        .where("factKey", "=", candidate.factKey)
        .where("factSchemaVersion", "=", candidate.factSchemaVersion)
        .where((builder) =>
          builder.not(
            builder.exists(
              builder
                .selectFrom("commercialFactCorrections")
                .select(sql`1`.as("one"))
                .whereRef(
                  "commercialFactCorrections.correctedFactId",
                  "=",
                  "commercialFacts.id",
                ),
            ),
          ),
        )
        .forUpdate()
        .execute();
      const activeIds = activeRows.map((row) => row.id).sort();
      const correctedIds = [...record.correctsFactIds].sort();
      if (
        record.mode === "correct" &&
        (activeIds.length !== correctedIds.length ||
          activeIds.some((id, index) => id !== correctedIds[index]))
      )
        throw new CommercialConflictError(
          "FACT_CORRECTION_STALE",
          "Correction must replace the complete active Fact set",
        );

      const factId = randomUUID();
      await transaction
        .insertInto("commercialFacts")
        .values({
          id: factId,
          organizationId: record.organizationId,
          leadId: candidate.leadId,
          factKey: candidate.factKey,
          factSchemaVersion: candidate.factSchemaVersion,
          valueType: record.valueType,
          value: serializeJsonb(candidate.proposedValue),
          sourceType: "human_declaration",
          sourceRef: candidate.id,
          declarerRef: record.authorityRef,
          authorityType: record.mode === "correct" ? "declared_human" : null,
          authorityRef: record.mode === "correct" ? record.authorityRef : null,
          executorRef: record.executorRef,
          evidenceType: "message",
          evidenceRef: candidate.messageId,
          observedAt: new Date(),
        })
        .execute();
      if (correctedIds.length > 0) {
        await transaction
          .insertInto("commercialFactCorrections")
          .values(
            correctedIds.map((correctedFactId) => ({
              organizationId: record.organizationId,
              correctiveFactId: factId,
              correctedFactId,
            })),
          )
          .execute();
      }
      await transaction
        .insertInto("commercialCandidateResolutions")
        .values({
          id: randomUUID(),
          organizationId: record.organizationId,
          candidateId: candidate.id,
          resolutionType: "confirmed",
          confirmationMode: record.mode,
          rejectionReasonCode: null,
          authorityType: "declared_human",
          authorityRef: record.authorityRef,
          executorRef: record.executorRef,
          commercialFactId: factId,
        })
        .execute();
      await this.insertEvent(
        transaction,
        candidate,
        "commercial_fact_candidate_confirmed",
        record.executorRef,
        {
          candidateId: candidate.id,
          factId,
          confirmationMode: record.mode,
        },
      );
      await this.completeCommand(transaction, record, factId);
    });
    return this.findCandidate(record.organizationId, record.candidateId);
  }

  public async reject(record: RejectCandidateRecord): Promise<FactCandidate> {
    await this.database.transaction().execute(async (transaction) => {
      const replay = await this.loadCommandReplay(transaction, record);
      if (replay) return;
      const candidate = await this.requireReviewableCandidate(
        transaction,
        record.organizationId,
        record.candidateId,
      );
      await transaction
        .insertInto("commercialCandidateResolutions")
        .values({
          id: randomUUID(),
          organizationId: record.organizationId,
          candidateId: candidate.id,
          resolutionType: "rejected",
          confirmationMode: null,
          rejectionReasonCode: record.reasonCode,
          authorityType: "declared_human",
          authorityRef: record.authorityRef,
          executorRef: record.executorRef,
          commercialFactId: null,
        })
        .execute();
      await this.insertEvent(
        transaction,
        candidate,
        "commercial_fact_candidate_rejected",
        record.executorRef,
        {
          candidateId: candidate.id,
          reasonCode: record.reasonCode,
        },
      );
      await this.completeCommand(transaction, record, candidate.id);
    });
    return this.findCandidate(record.organizationId, record.candidateId);
  }

  public async findCandidate(
    organizationId: string,
    candidateId: string,
  ): Promise<FactCandidate> {
    const row = await this.database
      .selectFrom("commercialFactCandidates")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", candidateId)
      .executeTakeFirst();
    if (row == null) throw new CommercialNotFoundError("Fact Candidate");
    return this.serializeCandidate(row);
  }

  private async serializeRun(
    row: CommercialInterpretationRunRow,
  ): Promise<InterpretationRun> {
    const candidates = await this.database
      .selectFrom("commercialFactCandidates")
      .selectAll()
      .where("organizationId", "=", row.organizationId)
      .where("interpretationRunId", "=", row.id)
      .orderBy("createdAt", "asc")
      .orderBy("id", "asc")
      .execute();
    return {
      id: row.id,
      organizationId: row.organizationId,
      leadId: row.leadId,
      conversationId: row.conversationId,
      messageId: row.messageId,
      status: row.status,
      providerId: row.providerId,
      modelId: row.modelId,
      returnedModelId: row.returnedModelId,
      instructionKey: row.instructionKey,
      instructionVersion: row.instructionVersion,
      instructionDigest: row.instructionDigest,
      outputSchemaVersion: 1,
      outputSchemaDigest: row.outputSchemaDigest,
      invocationConfig: row.invocationConfig,
      providerRequestId: row.providerRequestId,
      durationMs: row.durationMs,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      outputDigest: row.outputDigest,
      failureCode: row.failureCode,
      reprocessesRunId: row.reprocessesRunId,
      candidates: await Promise.all(
        candidates.map((candidate) => this.serializeCandidate(candidate)),
      ),
      startedAt: iso(row.startedAt),
      completedAt: row.completedAt == null ? null : iso(row.completedAt),
      failedAt: row.failedAt == null ? null : iso(row.failedAt),
    };
  }

  private async serializeCandidate(
    row: CommercialFactCandidateRow,
  ): Promise<FactCandidate> {
    const [evidence, resolution] = await Promise.all([
      this.database
        .selectFrom("commercialEvidenceSpans")
        .selectAll()
        .where("candidateId", "=", row.id)
        .executeTakeFirst(),
      this.database
        .selectFrom("commercialCandidateResolutions")
        .selectAll()
        .where("candidateId", "=", row.id)
        .executeTakeFirst(),
    ]);
    const status =
      resolution?.resolutionType === "confirmed"
        ? "confirmed"
        : resolution?.resolutionType === "rejected"
          ? "rejected"
          : row.classification === "reviewable"
            ? "pending_confirmation"
            : row.classification;
    return {
      id: row.id,
      organizationId: row.organizationId,
      leadId: row.leadId,
      interpretationRunId: row.interpretationRunId,
      messageId: row.messageId,
      factKey: row.factKey,
      factSchemaVersion: 1,
      valueType: row.valueType,
      proposedValue: row.proposedValue as boolean | number | string | null,
      classification: row.classification,
      ambiguityCode: row.ambiguityCode,
      ambiguityDetails: row.ambiguityDetails,
      validationCode: row.validationCode as FactCandidate["validationCode"],
      duplicateOfCandidateId: row.duplicateOfCandidateId,
      status,
      evidence:
        evidence == null
          ? null
          : {
              id: evidence.id,
              candidateId: evidence.candidateId,
              messageId: evidence.messageId,
              evidenceType: "message_text_span",
              startOffset: evidence.startOffset,
              endOffset: evidence.endOffset,
              spanDigest: evidence.spanDigest,
              createdAt: iso(evidence.createdAt),
            },
      createdAt: iso(row.createdAt),
    };
  }

  private async requireReviewableCandidate(
    transaction: Transaction<DatabaseSchema>,
    organizationId: string,
    candidateId: string,
  ) {
    const candidate = await transaction
      .selectFrom("commercialFactCandidates")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", candidateId)
      .forUpdate()
      .executeTakeFirst();
    if (candidate == null) throw new CommercialNotFoundError("Fact Candidate");
    if (candidate.classification !== "reviewable")
      throw new CommercialConflictError(
        "CANDIDATE_NOT_REVIEWABLE",
        "Only reviewable Candidates may be resolved",
      );
    const resolution = await transaction
      .selectFrom("commercialCandidateResolutions")
      .select("id")
      .where("candidateId", "=", candidateId)
      .executeTakeFirst();
    if (resolution != null)
      throw new CommercialConflictError(
        "CANDIDATE_ALREADY_RESOLVED",
        "Candidate already has a resolution",
      );
    return candidate;
  }

  private async loadCommandReplay(
    transaction: Transaction<DatabaseSchema>,
    record: {
      commandId: string;
      organizationId: string;
      candidateId: string;
      idempotencyKey: string;
      requestHash: string;
    },
  ): Promise<boolean> {
    const reserved = await transaction
      .insertInto("commercialCommands")
      .values({
        id: record.commandId,
        organizationId: record.organizationId,
        commandType: "resolve_commercial_fact_candidate_v1",
        idempotencyKey: record.idempotencyKey,
        requestHash: record.requestHash,
        status: "in_progress",
        targetType: "commercial_fact_candidate",
        targetId: record.candidateId,
        eventId: null,
        resultCode: "IN_PROGRESS",
        resultHttpStatus: 200,
        completedAt: null,
      })
      .onConflict((conflict) =>
        conflict
          .columns(["organizationId", "commandType", "idempotencyKey"])
          .doNothing(),
      )
      .returning("id")
      .executeTakeFirst();
    if (reserved != null) return false;
    const existing = await transaction
      .selectFrom("commercialCommands")
      .selectAll()
      .where("organizationId", "=", record.organizationId)
      .where("idempotencyKey", "=", record.idempotencyKey)
      .executeTakeFirst();
    if (existing == null) return false;
    if (existing.requestHash !== record.requestHash)
      throw new CommercialIdempotencyConflictError();
    return true;
  }

  private async completeCommand(
    transaction: Transaction<DatabaseSchema>,
    record: {
      commandId: string;
      organizationId: string;
      candidateId: string;
      idempotencyKey: string;
      requestHash: string;
    },
    targetId: string,
  ): Promise<void> {
    await transaction
      .updateTable("commercialCommands")
      .set({
        status: "completed",
        targetId,
        resultCode: "COMMERCIAL_FACT_CANDIDATE_RESOLVED",
        completedAt: new Date(),
      })
      .where("id", "=", record.commandId)
      .where("status", "=", "in_progress")
      .execute();
  }

  private async insertEvent(
    transaction: Transaction<DatabaseSchema>,
    subject: { organizationId: string; leadId: string; id: string },
    eventType:
      | "commercial_interpretation_started"
      | "commercial_interpretation_completed"
      | "commercial_interpretation_failed"
      | "commercial_fact_candidate_created"
      | "commercial_fact_candidate_confirmed"
      | "commercial_fact_candidate_rejected",
    actorRef: string,
    metadata: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    await transaction
      .insertInto("commercialEvents")
      .values({
        id: randomUUID(),
        organizationId: subject.organizationId,
        subjectType: "commercial_interpretation",
        subjectId: subject.id,
        leadId: subject.leadId,
        eventType,
        actorRef,
        metadata,
      })
      .execute();
  }
}
