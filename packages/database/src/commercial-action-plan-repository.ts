import { randomUUID } from "node:crypto";

import type {
  CommercialActionCandidate,
  CommercialActionPlan,
} from "@cognita/schemas";
import { type Kysely, type Transaction, sql } from "kysely";

import {
  CommercialConflictError,
  CommercialIdempotencyConflictError,
  CommercialInvariantError,
  CommercialNotFoundError,
  type CommandResult,
  type CommercialCommandExecution,
  serializeLead,
  serializeOpportunity,
} from "./commercial-repository.js";
import { buildCommercialFactSnapshots } from "./commercial-fact-snapshot.js";
import { serializeJsonb } from "./jsonb.js";
import type {
  CommercialActionCandidateRow,
  CommercialActionPlanRow,
  DatabaseSchema,
} from "./schema.js";

type TransactionExecutor = Transaction<DatabaseSchema>;

export interface ActionPlanCandidateEvaluation {
  candidateType: CommercialActionCandidate["candidateType"];
  requestedAction: CommercialActionCandidate["requestedAction"];
  requirementId: CommercialActionCandidate["requirementId"];
  requiredCapabilityKey: CommercialActionCandidate["requiredCapabilityKey"];
  decisionBasisFingerprint: string;
  rationaleCodes: CommercialActionCandidate["rationaleCodes"];
  decisionReasonCodes: string[];
}

export interface ActionPlanEvaluationRecord {
  objective: { key: string; version: string; digest: string };
  planner: { key: string; version: string; digest: string };
  actionCatalog: { key: string; version: string; digest: string };
  requirementPriority: { key: string; version: string; digest: string };
  inputSnapshot: Record<string, unknown>;
  inputFingerprint: string;
  outputDigest: string;
  resultType: "candidate" | "no_action";
  rationaleCodes: CommercialActionPlan["rationaleCodes"];
  candidate: ActionPlanCandidateEvaluation | null;
}

export interface ActionPlanningContext {
  lead: ReturnType<typeof serializeLead>;
  contactHasChannel: boolean;
  opportunity: ReturnType<typeof serializeOpportunity> | null;
  facts: Awaited<ReturnType<typeof buildCommercialFactSnapshots>>;
  now: string;
}

export type ActionPlanner = (
  context: ActionPlanningContext,
) => ActionPlanEvaluationRecord;

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

function serializeCandidate(
  row: CommercialActionCandidateRow,
): CommercialActionCandidate {
  return {
    id: row.id,
    organizationId: row.organizationId,
    leadId: row.leadId,
    opportunityId: row.opportunityId,
    actionPlanId: row.actionPlanId,
    candidateType: row.candidateType,
    requestedAction: row.requestedAction,
    requirementId: row.requirementId,
    requiredCapabilityKey: row.requiredCapabilityKey,
    decisionBasisFingerprint: row.decisionBasisFingerprint,
    rationaleCodes: row.rationaleCodes,
    decisionReasonCodes: row.decisionReasonCodes,
    recordedAt: iso(row.recordedAt),
  };
}

function sameCandidate(
  stored: CommercialActionCandidateRow,
  current: ActionPlanCandidateEvaluation | null,
): boolean {
  return (
    current != null &&
    stored.candidateType === current.candidateType &&
    stored.requestedAction === current.requestedAction &&
    stored.requirementId === current.requirementId &&
    stored.requiredCapabilityKey === current.requiredCapabilityKey &&
    stored.decisionBasisFingerprint === current.decisionBasisFingerprint &&
    JSON.stringify(stored.rationaleCodes) ===
      JSON.stringify(current.rationaleCodes) &&
    JSON.stringify(stored.decisionReasonCodes) ===
      JSON.stringify(current.decisionReasonCodes)
  );
}

function samePlan(
  stored: CommercialActionPlanRow,
  current: ActionPlanEvaluationRecord,
): boolean {
  return (
    stored.objectiveKey === current.objective.key &&
    stored.objectiveVersion === current.objective.version &&
    stored.objectiveDigest === current.objective.digest &&
    stored.plannerKey === current.planner.key &&
    stored.plannerVersion === current.planner.version &&
    stored.plannerDigest === current.planner.digest &&
    stored.actionCatalogKey === current.actionCatalog.key &&
    stored.actionCatalogVersion === current.actionCatalog.version &&
    stored.actionCatalogDigest === current.actionCatalog.digest &&
    stored.requirementPriorityKey === current.requirementPriority.key &&
    stored.requirementPriorityVersion === current.requirementPriority.version &&
    stored.requirementPriorityDigest === current.requirementPriority.digest &&
    stored.inputFingerprint === current.inputFingerprint &&
    stored.outputDigest === current.outputDigest &&
    stored.resultType === current.resultType
  );
}

async function planningContext(
  executor: TransactionExecutor | Kysely<DatabaseSchema>,
  organizationId: string,
  leadId: string,
  lock: boolean,
): Promise<ActionPlanningContext> {
  let leadQuery = executor
    .selectFrom("leads")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("id", "=", leadId);
  if (lock) leadQuery = leadQuery.forUpdate();
  const lead = await leadQuery.executeTakeFirst();
  if (lead == null) throw new CommercialNotFoundError("Lead");
  const contact = await executor
    .selectFrom("contacts")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("id", "=", lead.contactId)
    .executeTakeFirstOrThrow();
  let opportunityQuery = executor
    .selectFrom("opportunities")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("leadId", "=", leadId);
  if (lock) opportunityQuery = opportunityQuery.forUpdate();
  const opportunity = await opportunityQuery.executeTakeFirst();
  return {
    lead: serializeLead(lead),
    contactHasChannel:
      contact.normalizedEmail != null || contact.normalizedPhone != null,
    opportunity: opportunity == null ? null : serializeOpportunity(opportunity),
    facts: await buildCommercialFactSnapshots(executor, organizationId, leadId),
    now: new Date().toISOString(),
  };
}

export async function requireCurrentActionCandidate(
  transaction: TransactionExecutor,
  organizationId: string,
  candidateId: string,
  planner: ActionPlanner,
) {
  const candidate = await transaction
    .selectFrom("commercialActionCandidates")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("id", "=", candidateId)
    .forUpdate()
    .executeTakeFirst();
  if (candidate == null) throw new CommercialNotFoundError("Action Candidate");
  const plan = await transaction
    .selectFrom("commercialActionPlans")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("id", "=", candidate.actionPlanId)
    .executeTakeFirstOrThrow();
  const existingDecision = await transaction
    .selectFrom("commercialDecisions")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where("actionCandidateId", "=", candidateId)
    .executeTakeFirst();
  if (existingDecision != null) {
    throw new CommercialConflictError(
      "ACTION_CANDIDATE_ALREADY_EVALUATED",
      "Action Candidate already originated a Commercial Decision",
    );
  }
  const context = await planningContext(
    transaction,
    organizationId,
    candidate.leadId,
    true,
  );
  const current = planner(context);
  if (
    !samePlan(plan, current) ||
    !sameCandidate(candidate, current.candidate)
  ) {
    throw new CommercialConflictError(
      "ACTION_CANDIDATE_STALE",
      "Action Candidate no longer matches the current commercial context",
    );
  }
  return { candidate, plan, context, evaluation: current };
}

export class CommercialActionPlanRepository {
  public constructor(private readonly database: Kysely<DatabaseSchema>) {}

  public createPlan(
    command: CommercialCommandExecution,
    leadId: string,
    executorRef: string,
    planner: ActionPlanner,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      const context = await planningContext(
        transaction,
        command.organizationId,
        leadId,
        true,
      );
      const evaluation = planner(context);
      const planId = randomUUID();
      const inserted = await transaction
        .insertInto("commercialActionPlans")
        .values({
          id: planId,
          organizationId: command.organizationId,
          leadId,
          opportunityId: context.opportunity?.id ?? null,
          objectiveKey: evaluation.objective.key,
          objectiveVersion: evaluation.objective.version,
          objectiveDigest: evaluation.objective.digest,
          plannerKey: evaluation.planner.key,
          plannerVersion: evaluation.planner.version,
          plannerDigest: evaluation.planner.digest,
          actionCatalogKey: evaluation.actionCatalog.key,
          actionCatalogVersion: evaluation.actionCatalog.version,
          actionCatalogDigest: evaluation.actionCatalog.digest,
          requirementPriorityKey: evaluation.requirementPriority.key,
          requirementPriorityVersion: evaluation.requirementPriority.version,
          requirementPriorityDigest: evaluation.requirementPriority.digest,
          inputFingerprint: evaluation.inputFingerprint,
          inputSnapshot: serializeJsonb(evaluation.inputSnapshot),
          outputDigest: evaluation.outputDigest,
          resultType: evaluation.resultType,
          rationaleCodes: serializeJsonb(evaluation.rationaleCodes),
          executorRef,
        })
        .onConflict((conflict) =>
          conflict
            .columns([
              "organizationId",
              "leadId",
              "plannerKey",
              "plannerVersion",
              "inputFingerprint",
            ])
            .doNothing(),
        )
        .returning("id")
        .executeTakeFirst();
      if (inserted == null) {
        const existing = await transaction
          .selectFrom("commercialActionPlans")
          .select("id")
          .where("organizationId", "=", command.organizationId)
          .where("leadId", "=", leadId)
          .where("plannerKey", "=", evaluation.planner.key)
          .where("plannerVersion", "=", evaluation.planner.version)
          .where("inputFingerprint", "=", evaluation.inputFingerprint)
          .executeTakeFirstOrThrow();
        return { targetId: existing.id, eventId: null };
      }
      if (evaluation.resultType === "candidate") {
        if (evaluation.candidate == null)
          throw new CommercialInvariantError(
            "ACTION_PLAN_CANDIDATE_MISSING",
            "Candidate result must contain one Action Candidate",
          );
        await transaction
          .insertInto("commercialActionCandidates")
          .values({
            id: randomUUID(),
            organizationId: command.organizationId,
            leadId,
            opportunityId: context.opportunity?.id ?? null,
            actionPlanId: planId,
            ...evaluation.candidate,
            rationaleCodes: serializeJsonb(evaluation.candidate.rationaleCodes),
            decisionReasonCodes: serializeJsonb(
              evaluation.candidate.decisionReasonCodes,
            ),
          })
          .execute();
      }
      const eventId = randomUUID();
      await transaction
        .insertInto("commercialEvents")
        .values({
          id: eventId,
          organizationId: command.organizationId,
          subjectType: "commercial_action_plan",
          subjectId: planId,
          leadId,
          eventType: "commercial_action_plan_created",
          actorRef: executorRef,
          metadata: {
            resultType: evaluation.resultType,
            plannerVersion: evaluation.planner.version,
          },
        })
        .execute();
      return { targetId: planId, eventId };
    });
  }

  public async findPlan(
    organizationId: string,
    planId: string,
    planner: ActionPlanner,
  ): Promise<CommercialActionPlan | undefined> {
    const plan = await this.database
      .selectFrom("commercialActionPlans")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", planId)
      .executeTakeFirst();
    if (plan == null) return undefined;
    const [candidate, decision] = await Promise.all([
      this.database
        .selectFrom("commercialActionCandidates")
        .selectAll()
        .where("organizationId", "=", organizationId)
        .where("actionPlanId", "=", planId)
        .executeTakeFirst(),
      this.database
        .selectFrom("commercialActionCandidates as candidate")
        .innerJoin(
          "commercialDecisions as decision",
          "decision.actionCandidateId",
          "candidate.id",
        )
        .select("decision.id")
        .where("candidate.organizationId", "=", organizationId)
        .where("candidate.actionPlanId", "=", planId)
        .executeTakeFirst(),
    ]);
    let currentness: CommercialActionPlan["currentness"] = "historical";
    if (decision == null) {
      const current = planner(
        await planningContext(
          this.database,
          organizationId,
          plan.leadId,
          false,
        ),
      );
      currentness =
        samePlan(plan, current) &&
        (candidate == null
          ? current.candidate == null
          : sameCandidate(candidate, current.candidate))
          ? "current"
          : "stale";
    }
    return {
      id: plan.id,
      organizationId: plan.organizationId,
      leadId: plan.leadId,
      opportunityId: plan.opportunityId,
      objective: {
        key: plan.objectiveKey,
        version: plan.objectiveVersion,
        digest: plan.objectiveDigest,
      },
      planner: {
        key: plan.plannerKey,
        version: plan.plannerVersion,
        digest: plan.plannerDigest,
      },
      actionCatalog: {
        key: plan.actionCatalogKey,
        version: plan.actionCatalogVersion,
        digest: plan.actionCatalogDigest,
      },
      requirementPriority: {
        key: plan.requirementPriorityKey,
        version: plan.requirementPriorityVersion,
        digest: plan.requirementPriorityDigest,
      },
      inputFingerprint: plan.inputFingerprint,
      outputDigest: plan.outputDigest,
      resultType: plan.resultType,
      rationaleCodes: plan.rationaleCodes,
      executorRef: plan.executorRef,
      recordedAt: iso(plan.recordedAt),
      currentness,
      candidate: candidate == null ? null : serializeCandidate(candidate),
      decisionId: decision?.id ?? null,
      questionCandidate: null,
    };
  }

  public async findCandidateDecision(
    organizationId: string,
    candidateId: string,
  ) {
    const candidate = await this.database
      .selectFrom("commercialActionCandidates")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", candidateId)
      .executeTakeFirst();
    if (candidate == null)
      throw new CommercialNotFoundError("Action Candidate");
    const decision = await this.database
      .selectFrom("commercialDecisions")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("actionCandidateId", "=", candidateId)
      .executeTakeFirst();
    return { candidate: serializeCandidate(candidate), decision };
  }

  private runCommand(
    command: CommercialCommandExecution,
    mutation: (
      transaction: TransactionExecutor,
    ) => Promise<{ targetId: string; eventId: string | null }>,
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
}
