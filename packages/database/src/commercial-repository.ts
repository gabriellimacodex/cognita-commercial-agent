import { randomUUID } from "node:crypto";

import type {
  CommercialCommandReceipt,
  CommercialEvent,
  CommercialEventType,
  CommercialTimeline,
  Company,
  Contact,
  Conversation,
  Lead,
  LeadAssignment,
  LeadContext,
  Message,
  Opportunity,
  OpportunityState,
  Organization,
} from "@cognita/schemas";
import { type Kysely, type Transaction, sql } from "kysely";

import type {
  CommercialCommandRow,
  CommercialEventRow,
  CompanyRow,
  ContactRow,
  ConversationRow,
  DatabaseSchema,
  LeadAssignmentRow,
  LeadRow,
  MessageRow,
  OpportunityRow,
  OrganizationRow,
} from "./schema.js";
import type { DecisionEvaluator } from "./commercial-decision-repository.js";
import { buildCommercialFactSnapshots } from "./commercial-fact-snapshot.js";

type TransactionExecutor = Transaction<DatabaseSchema>;
type EventMetadata = Record<string, string | number | boolean | null>;

export class CommercialNotFoundError extends Error {
  public constructor(public readonly resourceType: string) {
    super(`${resourceType} was not found in the declared organization`);
    this.name = "CommercialNotFoundError";
  }
}

export class CommercialConflictError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommercialConflictError";
  }
}

export class CommercialIdempotencyConflictError extends Error {
  public constructor() {
    super(
      "Idempotency-Key was already used with a different commercial command",
    );
    this.name = "CommercialIdempotencyConflictError";
  }
}

export class CommercialInvariantError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommercialInvariantError";
  }
}

export interface CommercialCommandExecution {
  organizationId: string;
  commandType: string;
  idempotencyKey: string;
  requestHash: string;
  targetType: string;
  successCode: string;
  successHttpStatus: number;
}

export interface CommandResult {
  receipt: CommercialCommandReceipt;
  replayed: boolean;
  transition?: {
    fromState: OpportunityState;
    toState: OpportunityState;
  };
}

interface MutationReceipt {
  targetId: string | null;
  eventId: string | null;
  resultCode?: string;
  httpStatus?: number;
  decisionId?: string;
  decisionLeadId?: string;
  decisionActorRef?: string;
}

interface CommercialEventInput {
  organizationId: string;
  subjectType: string;
  subjectId: string;
  leadId: string | null;
  eventType: CommercialEventType;
  actorRef: string;
  metadata?: EventMetadata;
}

export interface CreateCompanyRecord {
  id: string;
  name: string;
  normalizedDomain: string | null;
  cnpjDigits: string | null;
}

export interface CreateContactRecord {
  id: string;
  name: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  companyId: string | null;
}

export interface CreateLeadRecord {
  id: string;
  contactId: string;
  companyId: string | null;
  source: string;
  externalNamespace: string | null;
  externalId: string | null;
  externalHash: string | null;
}

export interface CreateConversationRecord {
  id: string;
  leadId: string;
  channel: string;
  externalNamespace: string;
  externalThreadId: string | null;
  externalHash: string | null;
}

export interface CreateMessageRecord {
  id: string;
  body: string;
  occurredAt: Date;
  externalNamespace: string | null;
  externalId: string | null;
  externalHash: string | null;
}

function iso(value: Date): string {
  return value.toISOString();
}

function isoNullable(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function serializeOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    domain: row.normalizedDomain,
    cnpj: row.cnpjDigits,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeContact(row: ContactRow): Contact {
  return {
    id: row.id,
    organizationId: row.organizationId,
    companyId: row.companyId,
    name: row.name,
    email: row.normalizedEmail,
    phone: row.normalizedPhone,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeLead(row: LeadRow): Lead {
  return {
    id: row.id,
    organizationId: row.organizationId,
    contactId: row.contactId,
    companyId: row.companyId,
    source: row.source,
    status: row.status,
    externalNamespace: row.externalNamespace,
    externalId: row.externalId,
    closedAt: isoNullable(row.closedAt),
    convertedAt: isoNullable(row.convertedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeOpportunity(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    leadId: row.leadId,
    commercialState: row.commercialState,
    lastTransitionReasonCode: row.lastTransitionReasonCode,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    leadId: row.leadId,
    contactId: row.contactId,
    channel: row.channel,
    externalNamespace: row.externalNamespace,
    externalThreadId: row.externalThreadId,
    status: row.status,
    closedAt: isoNullable(row.closedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeMessage(row: MessageRow): Message {
  return {
    id: row.id,
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    sequence: row.sequence,
    direction: row.direction,
    authorType: row.authorType,
    contentType: row.contentType,
    body: row.body,
    externalNamespace: row.externalNamespace,
    externalId: row.externalId,
    occurredAt: iso(row.occurredAt),
    recordedAt: iso(row.recordedAt),
  };
}

export function serializeAssignment(row: LeadAssignmentRow): LeadAssignment {
  return {
    id: row.id,
    organizationId: row.organizationId,
    leadId: row.leadId,
    assigneeRef: row.assigneeRef,
    assignedAt: iso(row.assignedAt),
    endedAt: isoNullable(row.endedAt),
  };
}

export function serializeEvent(row: CommercialEventRow): CommercialEvent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    leadId: row.leadId,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    actorRef: row.actorRef,
    metadata: row.metadata,
    occurredAt: iso(row.occurredAt),
    recordedAt: iso(row.recordedAt),
  };
}

function serializeReceipt(row: CommercialCommandRow): CommercialCommandReceipt {
  if (row.status !== "completed" || row.completedAt == null) {
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

export class CommercialRepository {
  public constructor(private readonly database: Kysely<DatabaseSchema>) {}

  public async createOrganization(
    command: CommercialCommandExecution,
    organization: { id: string; name: string },
  ): Promise<CommandResult> {
    return this.database.transaction().execute(async (transaction) => {
      const inserted = await transaction
        .insertInto("organizations")
        .values({ id: organization.id, name: organization.name })
        .onConflict((conflict) => conflict.column("id").doNothing())
        .returning("id")
        .executeTakeFirst();

      const existingOrganization = await transaction
        .selectFrom("organizations")
        .select(["id", "name"])
        .where("id", "=", organization.id)
        .executeTakeFirstOrThrow();
      if (existingOrganization.name !== organization.name) {
        throw new CommercialConflictError(
          "ORGANIZATION_ID_CONFLICT",
          "Organization ID is already associated with different data",
        );
      }

      return this.executeCommand(transaction, command, () =>
        Promise.resolve({
          targetId: existingOrganization.id,
          eventId: null,
          resultCode:
            inserted == null ? "ORGANIZATION_EXISTS" : command.successCode,
          httpStatus: inserted == null ? 200 : command.successHttpStatus,
        }),
      );
    });
  }

  public createCompany(
    command: CommercialCommandExecution,
    record: CreateCompanyRecord,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      if (record.cnpjDigits != null) {
        const existing = await transaction
          .selectFrom("companies")
          .select("id")
          .where("organizationId", "=", command.organizationId)
          .where("cnpjDigits", "=", record.cnpjDigits)
          .executeTakeFirst();
        if (existing != null) {
          throw new CommercialConflictError(
            "COMPANY_CNPJ_CONFLICT",
            `CNPJ is already associated with company ${existing.id}`,
          );
        }
      }
      await transaction
        .insertInto("companies")
        .values({
          id: record.id,
          organizationId: command.organizationId,
          name: record.name,
          normalizedDomain: record.normalizedDomain,
          cnpjDigits: record.cnpjDigits,
        })
        .execute();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "company",
        subjectId: record.id,
        leadId: null,
        eventType: "company_created",
        actorRef,
      });
      return { targetId: record.id, eventId };
    });
  }

  public createContact(
    command: CommercialCommandExecution,
    record: CreateContactRecord,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      if (record.companyId != null) {
        await this.requireCompany(
          transaction,
          command.organizationId,
          record.companyId,
        );
      }
      await transaction
        .insertInto("contacts")
        .values({
          id: record.id,
          organizationId: command.organizationId,
          companyId: record.companyId,
          name: record.name,
          normalizedEmail: record.normalizedEmail,
          normalizedPhone: record.normalizedPhone,
        })
        .execute();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "contact",
        subjectId: record.id,
        leadId: null,
        eventType: "contact_created",
        actorRef,
        metadata:
          record.companyId == null ? {} : { companyId: record.companyId },
      });
      return { targetId: record.id, eventId };
    });
  }

  public linkContactCompany(
    command: CommercialCommandExecution,
    contactId: string,
    companyId: string,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      await this.requireCompany(transaction, command.organizationId, companyId);
      const contact = await this.requireContact(
        transaction,
        command.organizationId,
        contactId,
        true,
      );
      if (contact.companyId === companyId) {
        return {
          targetId: contactId,
          eventId: null,
          resultCode: "CONTACT_ALREADY_LINKED",
          httpStatus: 200,
        };
      }
      await transaction
        .updateTable("contacts")
        .set({
          companyId,
          updatedAt: sql`now()`,
        })
        .where("organizationId", "=", command.organizationId)
        .where("id", "=", contactId)
        .executeTakeFirstOrThrow();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "contact",
        subjectId: contactId,
        leadId: null,
        eventType: "contact_linked",
        actorRef,
        metadata: { companyId },
      });
      return { targetId: contactId, eventId };
    });
  }

  public createLead(
    command: CommercialCommandExecution,
    record: CreateLeadRecord,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      await this.requireContact(
        transaction,
        command.organizationId,
        record.contactId,
      );
      if (record.companyId != null) {
        await this.requireCompany(
          transaction,
          command.organizationId,
          record.companyId,
        );
      }
      if (record.externalId != null && record.externalNamespace != null) {
        const existing = await transaction
          .selectFrom("leads")
          .selectAll()
          .where("organizationId", "=", command.organizationId)
          .where("externalNamespace", "=", record.externalNamespace)
          .where("source", "=", record.source)
          .where("externalId", "=", record.externalId)
          .executeTakeFirst();
        if (existing != null) {
          if (existing.externalHash !== record.externalHash) {
            throw new CommercialConflictError(
              "LEAD_EXTERNAL_ID_CONFLICT",
              "External Lead identity is associated with different content",
            );
          }
          return {
            targetId: existing.id,
            eventId: null,
            resultCode: "LEAD_EXTERNAL_REPLAY",
            httpStatus: 200,
          };
        }
      }
      await transaction
        .insertInto("leads")
        .values({
          id: record.id,
          organizationId: command.organizationId,
          contactId: record.contactId,
          companyId: record.companyId,
          source: record.source,
          externalNamespace: record.externalNamespace,
          externalId: record.externalId,
          externalHash: record.externalHash,
          externalHashVersion: record.externalHash == null ? null : 1,
          closedAt: null,
          convertedAt: null,
        })
        .execute();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "lead",
        subjectId: record.id,
        leadId: record.id,
        eventType: "lead_created",
        actorRef,
        metadata: { contactId: record.contactId },
      });
      return { targetId: record.id, eventId };
    });
  }

  public linkLeadCompany(
    command: CommercialCommandExecution,
    leadId: string,
    companyId: string,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      await this.requireCompany(transaction, command.organizationId, companyId);
      const lead = await this.requireLead(
        transaction,
        command.organizationId,
        leadId,
        true,
      );
      if (lead.companyId === companyId) {
        return {
          targetId: leadId,
          eventId: null,
          resultCode: "LEAD_ALREADY_LINKED",
          httpStatus: 200,
        };
      }
      await transaction
        .updateTable("leads")
        .set({
          companyId,
          updatedAt: sql`now()`,
        })
        .where("organizationId", "=", command.organizationId)
        .where("id", "=", leadId)
        .executeTakeFirstOrThrow();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "lead",
        subjectId: leadId,
        leadId,
        eventType: "lead_company_linked",
        actorRef,
        metadata: { companyId },
      });
      return { targetId: leadId, eventId };
    });
  }

  public assignLead(
    command: CommercialCommandExecution,
    leadId: string,
    assignmentId: string,
    assigneeRef: string,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      await this.requireLead(transaction, command.organizationId, leadId, true);
      await transaction
        .updateTable("leadAssignments")
        .set({
          endedAt: sql`greatest(clock_timestamp(), assigned_at)`,
        })
        .where("organizationId", "=", command.organizationId)
        .where("leadId", "=", leadId)
        .where("endedAt", "is", null)
        .execute();
      await transaction
        .insertInto("leadAssignments")
        .values({
          id: assignmentId,
          organizationId: command.organizationId,
          leadId,
          assigneeRef,
          endedAt: null,
        })
        .execute();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "lead_assignment",
        subjectId: assignmentId,
        leadId,
        eventType: "owner_assigned",
        actorRef,
        metadata: { assignmentId },
      });
      return { targetId: assignmentId, eventId };
    });
  }

  public createConversation(
    command: CommercialCommandExecution,
    record: CreateConversationRecord,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      const lead = await this.requireLead(
        transaction,
        command.organizationId,
        record.leadId,
      );
      if (record.externalThreadId != null) {
        const existing = await transaction
          .selectFrom("conversations")
          .selectAll()
          .where("organizationId", "=", command.organizationId)
          .where("externalNamespace", "=", record.externalNamespace)
          .where("channel", "=", record.channel)
          .where("externalThreadId", "=", record.externalThreadId)
          .executeTakeFirst();
        if (existing != null) {
          if (existing.externalHash !== record.externalHash) {
            throw new CommercialConflictError(
              "CONVERSATION_EXTERNAL_ID_CONFLICT",
              "External Conversation identity is associated with different content",
            );
          }
          return {
            targetId: existing.id,
            eventId: null,
            resultCode: "CONVERSATION_EXTERNAL_REPLAY",
            httpStatus: 200,
          };
        }
      }
      await transaction
        .insertInto("conversations")
        .values({
          id: record.id,
          organizationId: command.organizationId,
          leadId: record.leadId,
          contactId: lead.contactId,
          channel: record.channel,
          externalNamespace: record.externalNamespace,
          externalThreadId: record.externalThreadId,
          externalHash: record.externalHash,
          externalHashVersion: record.externalHash == null ? null : 1,
          closedAt: null,
        })
        .execute();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "conversation",
        subjectId: record.id,
        leadId: record.leadId,
        eventType: "conversation_started",
        actorRef,
        metadata: { channel: record.channel },
      });
      return { targetId: record.id, eventId };
    });
  }

  public createMessage(
    command: CommercialCommandExecution,
    conversationId: string,
    record: CreateMessageRecord,
    actorRef: string,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      const conversation = await transaction
        .selectFrom("conversations")
        .selectAll()
        .where("organizationId", "=", command.organizationId)
        .where("id", "=", conversationId)
        .forUpdate()
        .executeTakeFirst();
      if (conversation == null)
        throw new CommercialNotFoundError("Conversation");
      if (conversation.status !== "open") {
        throw new CommercialInvariantError(
          "CONVERSATION_CLOSED",
          "A closed Conversation cannot receive Messages",
        );
      }
      if (record.externalId != null && record.externalNamespace != null) {
        const existing = await transaction
          .selectFrom("messages")
          .selectAll()
          .where("organizationId", "=", command.organizationId)
          .where("externalNamespace", "=", record.externalNamespace)
          .where("channel", "=", conversation.channel)
          .where("externalId", "=", record.externalId)
          .executeTakeFirst();
        if (existing != null) {
          if (
            existing.externalHash !== record.externalHash ||
            existing.conversationId !== conversationId
          ) {
            throw new CommercialConflictError(
              "MESSAGE_EXTERNAL_ID_CONFLICT",
              "External Message identity is associated with different content",
            );
          }
          return {
            targetId: existing.id,
            eventId: null,
            resultCode: "MESSAGE_EXTERNAL_REPLAY",
            httpStatus: 200,
          };
        }
      }
      const sequence = conversation.nextMessageSequence;
      await transaction
        .updateTable("conversations")
        .set({
          nextMessageSequence: sequence + 1,
          updatedAt: sql`now()`,
        })
        .where("organizationId", "=", command.organizationId)
        .where("id", "=", conversationId)
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("messages")
        .values({
          id: record.id,
          organizationId: command.organizationId,
          conversationId,
          channel: conversation.channel,
          sequence,
          direction: "inbound",
          authorType: "contact",
          contentType: "text",
          body: record.body,
          externalNamespace: record.externalNamespace,
          externalId: record.externalId,
          externalHash: record.externalHash,
          externalHashVersion: record.externalHash == null ? null : 1,
          occurredAt: record.occurredAt,
        })
        .execute();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "message",
        subjectId: record.id,
        leadId: conversation.leadId,
        eventType: "message_received",
        actorRef,
        metadata: { conversationId, sequence },
      });
      return { targetId: record.id, eventId };
    });
  }

  public createOpportunity(
    command: CommercialCommandExecution,
    opportunityId: string,
    leadId: string,
    decisionId: string,
    actorRef: string,
    evaluateDecision: DecisionEvaluator,
  ): Promise<CommandResult> {
    return this.runCommand(command, async (transaction) => {
      const lead = await this.requireLead(
        transaction,
        command.organizationId,
        leadId,
        true,
      );
      await this.requireDecisionUnused(
        transaction,
        command.organizationId,
        decisionId,
      );
      if (lead.status !== "open") {
        throw new CommercialInvariantError(
          "LEAD_NOT_OPEN",
          "Only an open Lead can be converted to an Opportunity",
        );
      }
      await this.requireApplicableDecision(
        transaction,
        command.organizationId,
        decisionId,
        leadId,
        null,
        "create_opportunity",
        null,
        lead.status,
        null,
        evaluateDecision,
      );
      const existing = await transaction
        .selectFrom("opportunities")
        .select("id")
        .where("organizationId", "=", command.organizationId)
        .where("leadId", "=", leadId)
        .executeTakeFirst();
      if (existing != null) {
        throw new CommercialConflictError(
          "OPPORTUNITY_ALREADY_EXISTS",
          "The Lead already has an Opportunity",
        );
      }
      await transaction
        .insertInto("opportunities")
        .values({
          id: opportunityId,
          organizationId: command.organizationId,
          leadId,
          lastTransitionReasonCode: null,
        })
        .execute();
      await transaction
        .updateTable("leads")
        .set({
          status: "converted",
          convertedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where("organizationId", "=", command.organizationId)
        .where("id", "=", leadId)
        .where("status", "=", "open")
        .executeTakeFirstOrThrow();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "opportunity",
        subjectId: opportunityId,
        leadId,
        eventType: "opportunity_created",
        actorRef,
        metadata: { initialState: "open" },
      });
      return {
        targetId: opportunityId,
        eventId,
        decisionId,
        decisionLeadId: leadId,
        decisionActorRef: actorRef,
      };
    });
  }

  public transitionOpportunity(
    command: CommercialCommandExecution,
    opportunityId: string,
    toState: OpportunityState,
    reasonCode: string,
    decisionId: string,
    actorRef: string,
    validateTransition: (
      fromState: OpportunityState,
      toState: OpportunityState,
    ) => void,
    evaluateDecision: DecisionEvaluator,
  ): Promise<CommandResult> {
    let transitionedFrom: OpportunityState | undefined;
    return this.runCommand(command, async (transaction) => {
      const current = await transaction
        .selectFrom("opportunities")
        .select(["commercialState", "leadId"])
        .where("organizationId", "=", command.organizationId)
        .where("id", "=", opportunityId)
        .forUpdate()
        .executeTakeFirst();
      if (current == null) throw new CommercialNotFoundError("Opportunity");
      await this.requireDecisionUnused(
        transaction,
        command.organizationId,
        decisionId,
      );
      validateTransition(current.commercialState, toState);
      await this.requireApplicableDecision(
        transaction,
        command.organizationId,
        decisionId,
        current.leadId,
        opportunityId,
        `transition_to_${toState}`,
        reasonCode,
        "converted",
        current.commercialState,
        evaluateDecision,
      );
      transitionedFrom = current.commercialState;
      await transaction
        .updateTable("opportunities")
        .set({
          commercialState: toState,
          lastTransitionReasonCode: reasonCode,
          updatedAt: sql`now()`,
        })
        .where("organizationId", "=", command.organizationId)
        .where("id", "=", opportunityId)
        .where("commercialState", "=", current.commercialState)
        .executeTakeFirstOrThrow();
      const eventId = await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "opportunity",
        subjectId: opportunityId,
        leadId: current.leadId,
        eventType: "state_changed",
        actorRef,
        metadata: { fromState: current.commercialState, toState, reasonCode },
      });
      return {
        targetId: opportunityId,
        eventId,
        decisionId,
        decisionLeadId: current.leadId,
        decisionActorRef: actorRef,
      };
    }).then((result) =>
      transitionedFrom == null || result.replayed
        ? result
        : {
            ...result,
            transition: { fromState: transitionedFrom, toState },
          },
    );
  }

  public async findOrganization(id: string): Promise<Organization | undefined> {
    const row = await this.database
      .selectFrom("organizations")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row == null ? undefined : serializeOrganization(row);
  }

  public async findCompany(
    organizationId: string,
    id: string,
  ): Promise<Company | undefined> {
    const row = await this.database
      .selectFrom("companies")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row == null ? undefined : serializeCompany(row);
  }

  public async findContact(
    organizationId: string,
    id: string,
  ): Promise<Contact | undefined> {
    const row = await this.database
      .selectFrom("contacts")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row == null ? undefined : serializeContact(row);
  }

  public async findLead(
    organizationId: string,
    id: string,
  ): Promise<Lead | undefined> {
    const row = await this.database
      .selectFrom("leads")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row == null ? undefined : serializeLead(row);
  }

  public async findConversation(
    organizationId: string,
    id: string,
  ): Promise<Conversation | undefined> {
    const row = await this.database
      .selectFrom("conversations")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row == null ? undefined : serializeConversation(row);
  }

  public async findOpportunity(
    organizationId: string,
    id: string,
  ): Promise<Opportunity | undefined> {
    const row = await this.database
      .selectFrom("opportunities")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row == null ? undefined : serializeOpportunity(row);
  }

  public async getLeadContext(
    organizationId: string,
    leadId: string,
  ): Promise<LeadContext | undefined> {
    const lead = await this.database
      .selectFrom("leads")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", leadId)
      .executeTakeFirst();
    if (lead == null) return undefined;
    const [contact, company, assignment, opportunity, conversations] =
      await Promise.all([
        this.database
          .selectFrom("contacts")
          .selectAll()
          .where("organizationId", "=", organizationId)
          .where("id", "=", lead.contactId)
          .executeTakeFirstOrThrow(),
        lead.companyId == null
          ? Promise.resolve(undefined)
          : this.database
              .selectFrom("companies")
              .selectAll()
              .where("organizationId", "=", organizationId)
              .where("id", "=", lead.companyId)
              .executeTakeFirst(),
        this.database
          .selectFrom("leadAssignments")
          .selectAll()
          .where("organizationId", "=", organizationId)
          .where("leadId", "=", leadId)
          .where("endedAt", "is", null)
          .executeTakeFirst(),
        this.database
          .selectFrom("opportunities")
          .selectAll()
          .where("organizationId", "=", organizationId)
          .where("leadId", "=", leadId)
          .executeTakeFirst(),
        this.database
          .selectFrom("conversations")
          .selectAll()
          .where("organizationId", "=", organizationId)
          .where("leadId", "=", leadId)
          .orderBy("createdAt", "asc")
          .execute(),
      ]);
    const conversationContexts = await Promise.all(
      conversations.map(async (conversation) => ({
        conversation: serializeConversation(conversation),
        messages: (
          await this.database
            .selectFrom("messages")
            .selectAll()
            .where("organizationId", "=", organizationId)
            .where("conversationId", "=", conversation.id)
            .orderBy("sequence", "asc")
            .execute()
        ).map(serializeMessage),
      })),
    );
    return {
      lead: serializeLead(lead),
      contact: serializeContact(contact),
      company: company == null ? null : serializeCompany(company),
      assignment: assignment == null ? null : serializeAssignment(assignment),
      opportunity:
        opportunity == null ? null : serializeOpportunity(opportunity),
      conversations: conversationContexts,
    };
  }

  public async getLeadTimeline(
    organizationId: string,
    leadId: string,
    limit: number,
    cursor?: string,
  ): Promise<CommercialTimeline | undefined> {
    const lead = await this.database
      .selectFrom("leads")
      .select(["id", "contactId", "companyId"])
      .where("organizationId", "=", organizationId)
      .where("id", "=", leadId)
      .executeTakeFirst();
    if (lead == null) return undefined;
    const inTimeline = sql<boolean>`(
      lead_id = ${leadId}
      or (subject_type = 'contact' and subject_id = ${lead.contactId})
      or (
        ${lead.companyId}::uuid is not null
        and subject_type = 'company'
        and subject_id = ${lead.companyId}::uuid
      )
    )`;
    let query = this.database
      .selectFrom("commercialEvents")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where(inTimeline);
    if (cursor != null) {
      const cursorRow = await this.database
        .selectFrom("commercialEvents")
        .select(["id", "recordedAt"])
        .where("organizationId", "=", organizationId)
        .where(inTimeline)
        .where("id", "=", cursor)
        .executeTakeFirst();
      if (cursorRow == null) {
        throw new CommercialNotFoundError("Timeline cursor");
      }
      query = query.where((expression) =>
        expression.or([
          expression("recordedAt", ">", cursorRow.recordedAt),
          expression.and([
            expression("recordedAt", "=", cursorRow.recordedAt),
            expression("id", ">", cursorRow.id),
          ]),
        ]),
      );
    }
    const rows = await query
      .orderBy("recordedAt", "asc")
      .orderBy("id", "asc")
      .limit(limit + 1)
      .execute();
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map(serializeEvent),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  private runCommand(
    command: CommercialCommandExecution,
    mutation: (transaction: TransactionExecutor) => Promise<MutationReceipt>,
  ): Promise<CommandResult> {
    return this.database.transaction().execute(async (transaction) => {
      const organization = await transaction
        .selectFrom("organizations")
        .select("id")
        .where("id", "=", command.organizationId)
        .executeTakeFirst();
      if (organization == null) {
        throw new CommercialNotFoundError("Organization");
      }
      return this.executeCommand(transaction, command, () =>
        mutation(transaction),
      );
    });
  }

  private async executeCommand(
    transaction: TransactionExecutor,
    command: CommercialCommandExecution,
    mutation: () => Promise<MutationReceipt>,
  ): Promise<CommandResult> {
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
      if (existing.requestHash !== command.requestHash) {
        throw new CommercialIdempotencyConflictError();
      }
      return { receipt: serializeReceipt(existing), replayed: true };
    }

    const result = await mutation();
    if (
      result.decisionId != null &&
      result.decisionLeadId != null &&
      result.decisionActorRef != null &&
      result.targetId != null
    ) {
      await transaction
        .insertInto("commercialDecisionApplications")
        .values({
          id: randomUUID(),
          organizationId: command.organizationId,
          decisionId: result.decisionId,
          commandId,
          targetType: command.targetType,
          targetId: result.targetId,
        })
        .execute();
      await this.insertEvent(transaction, {
        organizationId: command.organizationId,
        subjectType: "commercial_decision",
        subjectId: result.decisionId,
        leadId: result.decisionLeadId,
        eventType: "commercial_decision_applied",
        actorRef: result.decisionActorRef,
        metadata: {
          decisionId: result.decisionId,
          targetType: command.targetType,
          targetId: result.targetId,
        },
      });
    }
    const completed = await transaction
      .updateTable("commercialCommands")
      .set({
        status: "completed",
        targetId: result.targetId,
        eventId: result.eventId,
        resultCode: result.resultCode ?? command.successCode,
        resultHttpStatus: result.httpStatus ?? command.successHttpStatus,
        completedAt: sql`now()`,
      })
      .where("id", "=", commandId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return { receipt: serializeReceipt(completed), replayed: false };
  }

  private async requireApplicableDecision(
    transaction: TransactionExecutor,
    organizationId: string,
    decisionId: string,
    leadId: string,
    opportunityId: string | null,
    requestedAction: string,
    applicationReasonCode: string | null,
    leadStatus: string,
    opportunityState: OpportunityState | null,
    evaluateDecision: DecisionEvaluator,
  ): Promise<void> {
    const decision = await transaction
      .selectFrom("commercialDecisions")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", decisionId)
      .forUpdate()
      .executeTakeFirst();
    if (decision == null) throw new CommercialNotFoundError("Decision");
    if (
      decision.leadId !== leadId ||
      decision.opportunityId !== opportunityId ||
      decision.requestedAction !== requestedAction ||
      decision.outcome !== "allow" ||
      !decision.eligibleActions.some(
        (eligible) =>
          eligible.action === decision.requestedAction &&
          eligible.authorityType === decision.authorityType,
      )
    ) {
      throw new CommercialInvariantError(
        "DECISION_NOT_APPLICABLE",
        "Decision does not authorize this exact commercial action",
      );
    }
    if (
      decision.authorityType === "declared_human" &&
      applicationReasonCode != null &&
      decision.humanReasonCode !== applicationReasonCode
    ) {
      throw new CommercialInvariantError(
        "DECISION_NOT_APPLICABLE",
        "Human Decision reason does not match the material transition",
      );
    }
    const snapshot = decision.inputSnapshot;
    if (
      snapshot["leadStatus"] !== leadStatus ||
      snapshot["opportunityId"] !== opportunityId ||
      snapshot["opportunityState"] !== opportunityState
    ) {
      throw new CommercialConflictError(
        "DECISION_STALE",
        "Commercial state changed after Decision evaluation",
      );
    }
    const lead = await transaction
      .selectFrom("leads")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", leadId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const [contact, opportunity, facts, references, application] =
      await Promise.all([
        transaction
          .selectFrom("contacts")
          .selectAll()
          .where("organizationId", "=", organizationId)
          .where("id", "=", lead.contactId)
          .executeTakeFirstOrThrow(),
        opportunityId == null
          ? Promise.resolve(undefined)
          : transaction
              .selectFrom("opportunities")
              .selectAll()
              .where("organizationId", "=", organizationId)
              .where("id", "=", opportunityId)
              .executeTakeFirst(),
        buildCommercialFactSnapshots(transaction, organizationId, leadId),
        transaction
          .selectFrom("commercialDecisionFacts")
          .select("factId")
          .where("organizationId", "=", organizationId)
          .where("decisionId", "=", decisionId)
          .orderBy("factId")
          .execute(),
        transaction
          .selectFrom("commercialDecisionApplications")
          .select("id")
          .where("organizationId", "=", organizationId)
          .where("decisionId", "=", decisionId)
          .executeTakeFirst(),
      ]);
    const currentEvaluation = evaluateDecision(
      {
        organizationId,
        requestedAction: decision.requestedAction,
        authorityType: decision.authorityType,
        authorityRef: decision.authorityRef,
        executorRef: decision.executorRef,
        ...(decision.opportunityId == null
          ? {}
          : { opportunityId: decision.opportunityId }),
        ...(decision.humanReasonCode == null
          ? {}
          : { reasonCode: decision.humanReasonCode }),
        ...(decision.humanEvidenceType == null ||
        decision.humanEvidenceRef == null
          ? {}
          : {
              evidence: {
                type: decision.humanEvidenceType,
                ref: decision.humanEvidenceRef,
              },
            }),
      },
      {
        lead: serializeLead(lead),
        contactHasChannel:
          contact.normalizedEmail != null || contact.normalizedPhone != null,
        opportunity:
          opportunity == null ? null : serializeOpportunity(opportunity),
        facts,
        now: new Date().toISOString(),
      },
    );
    if (
      currentEvaluation.inputFingerprint !== decision.inputFingerprint ||
      currentEvaluation.policyKey !== decision.policyKey ||
      currentEvaluation.policyVersion !== decision.policyVersion ||
      currentEvaluation.policyDigest !== decision.policyDigest ||
      currentEvaluation.outcome !== "allow" ||
      !currentEvaluation.eligibleActions.some(
        (eligible) =>
          eligible.action === decision.requestedAction &&
          eligible.authorityType === decision.authorityType,
      )
    ) {
      throw new CommercialConflictError(
        "DECISION_STALE",
        "Decision input no longer produces the persisted authorization",
      );
    }
    const activeFacts = facts
      .flatMap((fact) => fact.facts)
      .map((fact) => ({ id: fact.id }))
      .sort((left, right) => left.id.localeCompare(right.id));
    if (application != null) {
      throw new CommercialConflictError(
        "DECISION_ALREADY_APPLIED",
        "Decision already has a material application",
      );
    }
    const expected = references.map((reference) => reference.factId);
    const current = activeFacts.map((fact) => fact.id);
    if (
      expected.length !== current.length ||
      expected.some((id, index) => id !== current[index])
    ) {
      throw new CommercialConflictError(
        "DECISION_STALE",
        "Active Facts changed after Decision evaluation",
      );
    }
  }

  private async requireDecisionUnused(
    transaction: TransactionExecutor,
    organizationId: string,
    decisionId: string,
  ): Promise<void> {
    const application = await transaction
      .selectFrom("commercialDecisionApplications")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("decisionId", "=", decisionId)
      .executeTakeFirst();
    if (application != null) {
      throw new CommercialConflictError(
        "DECISION_ALREADY_APPLIED",
        "Decision already has a material application",
      );
    }
  }

  private async insertEvent(
    transaction: TransactionExecutor,
    event: CommercialEventInput,
  ): Promise<string> {
    const id = randomUUID();
    await transaction
      .insertInto("commercialEvents")
      .values({
        id,
        organizationId: event.organizationId,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        leadId: event.leadId,
        eventType: event.eventType,
        actorRef: event.actorRef,
        metadata: event.metadata ?? {},
      })
      .execute();
    return id;
  }

  private async requireCompany(
    transaction: TransactionExecutor,
    organizationId: string,
    id: string,
  ): Promise<CompanyRow> {
    const row = await transaction
      .selectFrom("companies")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id)
      .executeTakeFirst();
    if (row == null) throw new CommercialNotFoundError("Company");
    return row;
  }

  private async requireContact(
    transaction: TransactionExecutor,
    organizationId: string,
    id: string,
    lock = false,
  ): Promise<ContactRow> {
    let query = transaction
      .selectFrom("contacts")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id);
    if (lock) query = query.forUpdate();
    const row = await query.executeTakeFirst();
    if (row == null) throw new CommercialNotFoundError("Contact");
    return row;
  }

  private async requireLead(
    transaction: TransactionExecutor,
    organizationId: string,
    id: string,
    lock = false,
  ): Promise<LeadRow> {
    let query = transaction
      .selectFrom("leads")
      .selectAll()
      .where("organizationId", "=", organizationId)
      .where("id", "=", id);
    if (lock) query = query.forUpdate();
    const row = await query.executeTakeFirst();
    if (row == null) throw new CommercialNotFoundError("Lead");
    return row;
  }
}
