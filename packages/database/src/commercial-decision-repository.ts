import { randomUUID } from "node:crypto";

import type {
  CommercialDecision,
  CommercialDecisionContext,
  CommercialFactSnapshot,
  CommercialRequirementId,
  CreateCommercialDecisionInput,
  EvaluateCommercialActionCandidateInput,
} from "@cognita/schemas";
import { createCommercialDecisionInputSchema } from "@cognita/schemas";
import { type Kysely, type Transaction, sql } from "kysely";

import {
  CommercialConflictError,
  CommercialIdempotencyConflictError,
  CommercialInvariantError,
  CommercialNotFoundError,
  type CommandResult,
  type CommercialCommandExecution,
  serializeContact,
  serializeLead,
  serializeOpportunity,
} from "./commercial-repository.js";
import { buildCommercialFactSnapshots } from "./commercial-fact-snapshot.js";
import {
  requireCurrentActionCandidate,
  type ActionPlanner,
} from "./commercial-action-plan-repository.js";
import { serializeJsonb } from "./jsonb.js";
import type {
  CommercialDecisionRow,
  CommercialFactRow,
  DatabaseSchema,
} from "./schema.js";

type TransactionExecutor = Transaction<DatabaseSchema>;

export interface CommercialFactRecord {
  id: string;
  organizationId: string;
  leadId: string;
  factKey: CommercialFactRow["factKey"];
  factSchemaVersion: number;
  valueType: CommercialFactRow["valueType"];
  value: unknown;
  sourceType: CommercialFactRow["sourceType"];
  sourceRef: string;
  declarerRef: string;
  authorityType: CommercialFactRow["authorityType"];
  authorityRef: string | null;
  executorRef: string;
  evidenceType: CommercialFactRow["evidenceType"];
  evidenceRef: string | null;
  observedAt: Date;
  correctsFactIds: string[];
}

export interface DecisionEvaluationRecord {
  decisionType: string;
  policyKey: string;
  policyVersion: string;
  policyDigest: string;
  decisionSchemaVersion: number;
  inputSnapshot: Record<string, unknown>;
  inputFingerprint: string;
  outcome: CommercialDecisionRow["outcome"];
  eligibleActions: CommercialDecisionRow["eligibleActions"];
  blockedActions: CommercialDecisionRow["blockedActions"];
  missingRequirements: CommercialRequirementId[];
  requiredEvidence: string[];
  reasonCodes: string[];
  escalationRequired: boolean;
  factIds: string[];
}

export interface DecisionEvaluationContext {
  lead: ReturnType<typeof serializeLead>;
  contactHasChannel: boolean;
  opportunity: ReturnType<typeof serializeOpportunity> | null;
  facts: CommercialFactSnapshot[];
  now: string;
}

export type DecisionEvaluator = (
  input: CreateCommercialDecisionInput,
  context: DecisionEvaluationContext,
) => DecisionEvaluationRecord;

function iso(value: Date): string {
  return value.toISOString();
}

function serializeReceipt(row: {
  id: string;
  commandType: string;
  targetType: string;
  targetId: string | null;
  eventId: string | null;
  resultCode: string;
  resultHttpStatus: number;
  resultSchemaVersion: number;
  completedAt: Date | null;
}) {
  if (row.completedAt == null) {
    throw new CommercialInvariantError(
      "COMMERCIAL_COMMAND_IN_PROGRESS",
      "A persisted in-progress command requires operational investigation",
    );
  }
  return {
    commandId: row.id,
    commandType: row.commandType,
    targetType: row.targetType,
    targetId: row.targetId,
    eventId: row.eventId,
    resultCode: row.resultCode,
    httpStatus: row.resultHttpStatus,
    schemaVersion: row.resultSchemaVersion,
    completedAt: iso(row.completedAt),
  };
}

function serializeDecision(
  row: CommercialDecisionRow,
  factIds: string[],
  appliedAt: Date | null,
): CommercialDecision {
  return {
    id: row.id,
    organizationId: row.organizationId,
    leadId: row.leadId,
    opportunityId: row.opportunityId,
    decisionType: row.decisionType,
    requestedAction: row.requestedAction,
    authorityType: row.authorityType,
    authorityRef: row.authorityRef,
    executorRef: row.executorRef,
    policyKey: row.policyKey,
    policyVersion: row.policyVersion,
    policyDigest: row.policyDigest,
    decisionSchemaVersion: row.decisionSchemaVersion,
    inputFingerprint: row.inputFingerprint,
    outcome: row.outcome,
    eligibleActions: row.eligibleActions,
    blockedActions: row.blockedActions,
    missingRequirements: row.missingRequirements,
    requiredEvidence: row.requiredEvidence,
    reasonCodes: row.reasonCodes,
    escalationRequired: row.escalationRequired,
    humanReasonCode: row.humanReasonCode,
    humanEvidence:
      row.humanEvidenceType == null || row.humanEvidenceRef == null
        ? null
        : { type: row.humanEvidenceType, ref: row.humanEvidenceRef },
    actionCandidateId: row.actionCandidateId,
    factIds,
    appliedAt: appliedAt == null ? null : iso(appliedAt),
    recordedAt: iso(row.recordedAt),
  };
}

export class CommercialDecisionRepository {
  public constructor(private readonly database: Kysely<DatabaseSchema>) {}

  public createFact(
    command: CommercialCommandExecution,
    record: CommercialFactRecord,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      await this.requireLeadLock(
        transaction,
        record.organizationId,
        record.leadId,
      );
      await this.validateEvidence(
        transaction,
        record.organizationId,
        record.leadId,
        record.evidenceType,
        record.evidenceRef,
      );
      const active = await this.loadActiveFactRows(
        transaction,
        record.organizationId,
        record.leadId,
        record.factKey,
        record.factSchemaVersion,
      );
      const activeIds = active.map((fact) => fact.id).sort();
      const correctedIds = [...record.correctsFactIds].sort();
      if (correctedIds.length > 0) {
        if (
          record.authorityType !== "declared_human" ||
          record.authorityRef == null ||
          record.evidenceType == null ||
          activeIds.length !== correctedIds.length ||
          activeIds.some((id, index) => id !== correctedIds[index])
        ) {
          throw new CommercialConflictError(
            "FACT_CORRECTION_STALE",
            "Correction must replace the complete active Fact set",
          );
        }
      }
      await transaction
        .insertInto("commercialFacts")
        .values({
          id: record.id,
          organizationId: record.organizationId,
          leadId: record.leadId,
          factKey: record.factKey,
          factSchemaVersion: record.factSchemaVersion,
          valueType: record.valueType,
          value: serializeJsonb(record.value),
          sourceType: record.sourceType,
          sourceRef: record.sourceRef,
          declarerRef: record.declarerRef,
          authorityType: record.authorityType,
          authorityRef: record.authorityRef,
          executorRef: record.executorRef,
          evidenceType: record.evidenceType,
          evidenceRef: record.evidenceRef,
          observedAt: record.observedAt,
        })
        .execute();
      if (correctedIds.length > 0) {
        await transaction
          .insertInto("commercialFactCorrections")
          .values(
            correctedIds.map((correctedFactId) => ({
              organizationId: record.organizationId,
              correctiveFactId: record.id,
              correctedFactId,
            })),
          )
          .execute();
      }
      const conflicts =
        correctedIds.length === 0 &&
        active.some(
          (fact) => JSON.stringify(fact.value) !== JSON.stringify(record.value),
        );
      const eventId = await this.insertEvent(transaction, {
        organizationId: record.organizationId,
        subjectId: record.id,
        leadId: record.leadId,
        eventType: conflicts
          ? "commercial_fact_conflict_detected"
          : "commercial_fact_recorded",
        actorRef: record.executorRef,
        metadata: {
          factKey: record.factKey,
          factSchemaVersion: record.factSchemaVersion,
        },
      });
      return { targetId: record.id, eventId };
    });
  }

  public createDecision(
    command: CommercialCommandExecution,
    leadId: string,
    input: CreateCommercialDecisionInput,
    evaluator: DecisionEvaluator,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      const lead = await this.requireLeadLock(
        transaction,
        input.organizationId,
        leadId,
      );
      const contact = await transaction
        .selectFrom("contacts")
        .selectAll()
        .where("organizationId", "=", input.organizationId)
        .where("id", "=", lead.contactId)
        .executeTakeFirstOrThrow();
      const opportunity = await transaction
        .selectFrom("opportunities")
        .selectAll()
        .where("organizationId", "=", input.organizationId)
        .where("leadId", "=", leadId)
        .executeTakeFirst();
      if (
        input.opportunityId != null &&
        input.opportunityId !== opportunity?.id
      ) {
        throw new CommercialNotFoundError("Opportunity");
      }
      await this.validateEvidence(
        transaction,
        input.organizationId,
        leadId,
        input.evidence?.type ?? null,
        input.evidence?.ref ?? null,
      );
      const facts = await buildCommercialFactSnapshots(
        transaction,
        input.organizationId,
        leadId,
      );
      const evaluation = evaluator(input, {
        lead: serializeLead(lead),
        contactHasChannel:
          contact.normalizedEmail != null || contact.normalizedPhone != null,
        opportunity:
          opportunity == null ? null : serializeOpportunity(opportunity),
        facts,
        now: new Date().toISOString(),
      });
      return this.persistDecision(
        transaction,
        leadId,
        input,
        evaluation,
        facts,
        null,
      );
    });
  }

  public createDecisionFromActionCandidate(
    command: CommercialCommandExecution,
    candidateId: string,
    authority: EvaluateCommercialActionCandidateInput,
    evaluator: DecisionEvaluator,
    planner: ActionPlanner,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      const current = await requireCurrentActionCandidate(
        transaction,
        authority.organizationId,
        candidateId,
        planner,
      );
      const candidate = current.candidate;
      if (
        candidate.candidateType === "collect_requirement" ||
        candidate.requiredCapabilityKey ===
          "resolve_commercial_fact_conflict_v1"
      ) {
        throw new CommercialConflictError(
          "ACTION_CANDIDATE_NOT_ADMISSIBLE",
          "Action Candidate requires information or Fact correction before a new Plan",
        );
      }
      if (
        candidate.requiredCapabilityKey === "review_commercial_exception_v1" &&
        authority.authorityType !== "declared_human"
      ) {
        throw new CommercialConflictError(
          "ACTION_CANDIDATE_HUMAN_AUTHORITY_REQUIRED",
          "Review Candidate requires declared human authority",
        );
      }
      if (
        candidate.requiredCapabilityKey === "review_commercial_exception_v1" &&
        authority.reasonCode !==
          (candidate.requestedAction === "transition_to_qualified"
            ? "human_qualification_confirmed"
            : candidate.decisionReasonCodes.find(
                (reason) => reason !== "human_authority_required",
              ))
      ) {
        throw new CommercialConflictError(
          "ACTION_CANDIDATE_HUMAN_REASON_INVALID",
          "Human reason must resolve the review condition represented by the Candidate",
        );
      }
      const parsed = createCommercialDecisionInputSchema.safeParse({
        ...authority,
        requestedAction: candidate.requestedAction,
        ...(candidate.opportunityId == null
          ? {}
          : { opportunityId: candidate.opportunityId }),
      });
      if (!parsed.success) {
        throw new CommercialConflictError(
          "ACTION_CANDIDATE_AUTHORITY_INVALID",
          "Candidate authority does not satisfy the canonical Decision contract",
        );
      }
      const input = parsed.data;
      await this.validateEvidence(
        transaction,
        input.organizationId,
        candidate.leadId,
        input.evidence?.type ?? null,
        input.evidence?.ref ?? null,
      );
      const evaluation = evaluator(input, current.context);
      if (evaluation.inputFingerprint !== candidate.decisionBasisFingerprint) {
        throw new CommercialConflictError(
          "ACTION_CANDIDATE_DECISION_BASIS_STALE",
          "Action Candidate no longer matches the canonical Decision basis",
        );
      }
      return this.persistDecision(
        transaction,
        candidate.leadId,
        input,
        evaluation,
        current.context.facts,
        candidate.id,
      );
    });
  }

  public async listFacts(
    organizationId: string,
    leadId: string,
  ): Promise<CommercialFactSnapshot[]> {
    const lead = await this.database
      .selectFrom("leads")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("id", "=", leadId)
      .executeTakeFirst();
    if (lead == null) throw new CommercialNotFoundError("Lead");
    return buildCommercialFactSnapshots(this.database, organizationId, leadId);
  }

  public async findDecision(
    organizationId: string,
    decisionId: string,
  ): Promise<CommercialDecision | undefined> {
    const row = await this.database
      .selectFrom("commercialDecisions")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", decisionId)
      .executeTakeFirst();
    if (row == null) return undefined;
    const [factRefs, application] = await Promise.all([
      this.database
        .selectFrom("commercialDecisionFacts")
        .select("factId")
        .where("organizationId", "=", organizationId)
        .where("decisionId", "=", decisionId)
        .orderBy("factId")
        .execute(),
      this.database
        .selectFrom("commercialDecisionApplications")
        .select("appliedAt")
        .where("organizationId", "=", organizationId)
        .where("decisionId", "=", decisionId)
        .executeTakeFirst(),
    ]);
    return serializeDecision(
      row,
      factRefs.map((reference) => reference.factId),
      application?.appliedAt ?? null,
    );
  }

  public async getDecisionContext(
    organizationId: string,
    leadId: string,
  ): Promise<CommercialDecisionContext> {
    const lead = await this.database
      .selectFrom("leads")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", leadId)
      .executeTakeFirst();
    if (lead == null) throw new CommercialNotFoundError("Lead");
    const [contact, opportunity, facts, latest] = await Promise.all([
      this.database
        .selectFrom("contacts")
        .selectAll()
        .where("organizationId", "=", organizationId)
        .where("id", "=", lead.contactId)
        .executeTakeFirstOrThrow(),
      this.database
        .selectFrom("opportunities")
        .selectAll()
        .where("organizationId", "=", organizationId)
        .where("leadId", "=", leadId)
        .executeTakeFirst(),
      buildCommercialFactSnapshots(this.database, organizationId, leadId),
      this.database
        .selectFrom("commercialDecisions")
        .select("id")
        .where("organizationId", "=", organizationId)
        .where("leadId", "=", leadId)
        .orderBy("recordedAt", "desc")
        .orderBy("id", "desc")
        .executeTakeFirst(),
    ]);
    return {
      lead: serializeLead(lead),
      contact: serializeContact(contact),
      opportunity:
        opportunity == null ? null : serializeOpportunity(opportunity),
      facts,
      latestDecision:
        latest == null
          ? null
          : ((await this.findDecision(organizationId, latest.id)) ?? null),
    };
  }

  private loadActiveFactRows(
    executor: TransactionExecutor,
    organizationId: string,
    leadId: string,
    factKey: CommercialFactRow["factKey"],
    factSchemaVersion: number,
  ) {
    return executor
      .selectFrom("commercialFacts as fact")
      .selectAll("fact")
      .where("fact.organizationId", "=", organizationId)
      .where("fact.leadId", "=", leadId)
      .where("fact.factKey", "=", factKey)
      .where("fact.factSchemaVersion", "=", factSchemaVersion)
      .where(
        sql<boolean>`not exists (
          select 1 from commercial_fact_corrections correction
          where correction.corrected_fact_id = fact.id
        )`,
      )
      .orderBy("fact.id")
      .execute();
  }

  private async validateEvidence(
    transaction: TransactionExecutor,
    organizationId: string,
    leadId: string,
    evidenceType: CommercialFactRow["evidenceType"],
    evidenceRef: string | null,
  ): Promise<void> {
    if (evidenceType == null || evidenceRef == null) return;
    if (evidenceType === "human_attestation") return;
    if (evidenceType === "message") {
      const message = await transaction
        .selectFrom("messages")
        .innerJoin(
          "conversations",
          "conversations.id",
          "messages.conversationId",
        )
        .select("messages.id")
        .where("messages.organizationId", "=", organizationId)
        .where("messages.id", "=", evidenceRef)
        .where("conversations.leadId", "=", leadId)
        .executeTakeFirst();
      if (message == null)
        throw new CommercialNotFoundError("Evidence Message");
      return;
    }
    const event = await transaction
      .selectFrom("commercialEvents")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("id", "=", evidenceRef)
      .where("leadId", "=", leadId)
      .executeTakeFirst();
    if (event == null) throw new CommercialNotFoundError("Evidence Event");
  }

  private async persistDecision(
    transaction: TransactionExecutor,
    leadId: string,
    input: CreateCommercialDecisionInput,
    evaluation: DecisionEvaluationRecord,
    facts: CommercialFactSnapshot[],
    actionCandidateId: string | null,
  ): Promise<{ targetId: string; eventId: string }> {
    const decisionId = randomUUID();
    await transaction
      .insertInto("commercialDecisions")
      .values({
        id: decisionId,
        organizationId: input.organizationId,
        leadId,
        opportunityId: input.opportunityId ?? null,
        decisionType: evaluation.decisionType,
        requestedAction: input.requestedAction,
        authorityType: input.authorityType,
        authorityRef: input.authorityRef,
        executorRef: input.executorRef,
        policyKey: evaluation.policyKey,
        policyVersion: evaluation.policyVersion,
        policyDigest: evaluation.policyDigest,
        decisionSchemaVersion: evaluation.decisionSchemaVersion,
        inputFingerprint: evaluation.inputFingerprint,
        inputSnapshot: serializeJsonb(evaluation.inputSnapshot),
        outcome: evaluation.outcome,
        eligibleActions: serializeJsonb(evaluation.eligibleActions),
        blockedActions: serializeJsonb(evaluation.blockedActions),
        missingRequirements: serializeJsonb(evaluation.missingRequirements),
        requiredEvidence: serializeJsonb(evaluation.requiredEvidence),
        reasonCodes: serializeJsonb(evaluation.reasonCodes),
        escalationRequired: evaluation.escalationRequired,
        humanReasonCode: input.reasonCode ?? null,
        humanEvidenceType: input.evidence?.type ?? null,
        humanEvidenceRef: input.evidence?.ref ?? null,
        actionCandidateId,
      })
      .execute();
    if (evaluation.factIds.length > 0) {
      const activeFacts = facts.flatMap((snapshot) => snapshot.facts);
      const keyById = new Map(
        activeFacts.map((fact) => [fact.id, fact.factKey]),
      );
      await transaction
        .insertInto("commercialDecisionFacts")
        .values(
          evaluation.factIds.map((factId) => ({
            organizationId: input.organizationId,
            decisionId,
            factId,
            factKey: keyById.get(factId)!,
          })),
        )
        .execute();
    }
    const eventId = await this.insertEvent(transaction, {
      organizationId: input.organizationId,
      subjectId: decisionId,
      leadId,
      eventType: evaluation.escalationRequired
        ? "commercial_decision_escalated"
        : "commercial_decision_evaluated",
      actorRef: input.executorRef,
      metadata: {
        outcome: evaluation.outcome,
        policyKey: evaluation.policyKey,
        policyVersion: evaluation.policyVersion,
        requestedAction: input.requestedAction,
        actionCandidateId,
      },
    });
    return { targetId: decisionId, eventId };
  }

  private async requireLeadLock(
    transaction: TransactionExecutor,
    organizationId: string,
    leadId: string,
  ) {
    const lead = await transaction
      .selectFrom("leads")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", leadId)
      .forUpdate()
      .executeTakeFirst();
    if (lead == null) throw new CommercialNotFoundError("Lead");
    return lead;
  }

  private runCommand(
    command: CommercialCommandExecution,
    mutation: (
      transaction: TransactionExecutor,
    ) => Promise<{ targetId: string; eventId: string }>,
  ): Promise<CommandResult> {
    return this.database.transaction().execute(async (transaction) => {
      const organization = await transaction
        .selectFrom("organizations")
        .select("id")
        .where("id", "=", command.organizationId)
        .executeTakeFirst();
      if (organization == null)
        throw new CommercialNotFoundError("Organization");
      const commandId = randomUUID();
      const reserved = await transaction
        .insertInto("commercialCommands")
        .values({
          id: commandId,
          organizationId: command.organizationId,
          commandType: command.commandType,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          status: "in_progress",
          targetType: command.targetType,
          targetId: null,
          eventId: null,
          resultCode: "IN_PROGRESS",
          resultHttpStatus: command.successHttpStatus,
          completedAt: null,
        })
        .onConflict((conflict) =>
          conflict
            .columns(["organizationId", "commandType", "idempotencyKey"])
            .doNothing(),
        )
        .returningAll()
        .executeTakeFirst();
      if (reserved == null) {
        const existing = await transaction
          .selectFrom("commercialCommands")
          .selectAll()
          .where("organizationId", "=", command.organizationId)
          .where("commandType", "=", command.commandType)
          .where("idempotencyKey", "=", command.idempotencyKey)
          .executeTakeFirstOrThrow();
        if (existing.requestHash !== command.requestHash)
          throw new CommercialIdempotencyConflictError();
        return { receipt: serializeReceipt(existing), replayed: true };
      }
      const result = await mutation(transaction);
      const completed = await transaction
        .updateTable("commercialCommands")
        .set({
          status: "completed",
          targetId: result.targetId,
          eventId: result.eventId,
          resultCode: command.successCode,
          resultHttpStatus: command.successHttpStatus,
          completedAt: sql`now()`,
        })
        .where("id", "=", commandId)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { receipt: serializeReceipt(completed), replayed: false };
    });
  }

  private async insertEvent(
    transaction: TransactionExecutor,
    input: {
      organizationId: string;
      subjectId: string;
      leadId: string;
      eventType:
        | "commercial_fact_recorded"
        | "commercial_fact_conflict_detected"
        | "commercial_decision_evaluated"
        | "commercial_decision_escalated";
      actorRef: string;
      metadata: Record<string, string | number | boolean | null>;
    },
  ): Promise<string> {
    const eventId = randomUUID();
    await transaction
      .insertInto("commercialEvents")
      .values({
        id: eventId,
        organizationId: input.organizationId,
        subjectType: input.eventType.startsWith("commercial_fact")
          ? "commercial_fact"
          : "commercial_decision",
        subjectId: input.subjectId,
        leadId: input.leadId,
        eventType: input.eventType,
        actorRef: input.actorRef,
        metadata: input.metadata,
      })
      .execute();
    return eventId;
  }
}
