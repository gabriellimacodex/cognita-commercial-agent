import type {
  CommercialEventType,
  FoundationJobInput,
  FoundationJobStatus,
  LeadStatus,
  OpportunityState,
} from "@cognita/schemas";
import type {
  ColumnType,
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
} from "kysely";

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface OrganizationsTable {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FoundationJobsTable {
  id: string;
  idempotencyKey: string;
  requestHash: string;
  input: FoundationJobInput;
  status: Generated<FoundationJobStatus>;
  publishAttempts: Generated<number>;
  processAttempts: Generated<number>;
  nextPublishAt: Timestamp;
  nextProcessAt: Date | null;
  processLeaseExpiresAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  resultAlgorithm: "sha256" | null;
  resultDigest: string | null;
  resultInputBytes: number | null;
  queuedAt: Date | null;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CommercialCommandsTable {
  id: string;
  organizationId: string;
  commandType: string;
  idempotencyKey: string;
  requestHash: string;
  status: "in_progress" | "completed";
  targetType: string;
  targetId: string | null;
  eventId: string | null;
  resultCode: string;
  resultHttpStatus: number;
  resultSchemaVersion: Generated<number>;
  createdAt: Timestamp;
  completedAt: Date | null;
}

export interface CompaniesTable {
  id: string;
  organizationId: string;
  name: string;
  normalizedDomain: string | null;
  cnpjDigits: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ContactsTable {
  id: string;
  organizationId: string;
  companyId: string | null;
  name: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LeadsTable {
  id: string;
  organizationId: string;
  contactId: string;
  companyId: string | null;
  source: string;
  status: Generated<LeadStatus>;
  externalNamespace: string | null;
  externalId: string | null;
  externalHash: string | null;
  externalHashVersion: number | null;
  closedAt: Date | null;
  convertedAt: Date | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OpportunitiesTable {
  id: string;
  organizationId: string;
  leadId: string;
  commercialState: Generated<OpportunityState>;
  lastTransitionReasonCode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConversationsTable {
  id: string;
  organizationId: string;
  leadId: string;
  contactId: string;
  channel: string;
  externalNamespace: string;
  externalThreadId: string | null;
  externalHash: string | null;
  externalHashVersion: number | null;
  status: Generated<"open" | "closed">;
  nextMessageSequence: Generated<number>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt: Date | null;
}

export interface MessagesTable {
  id: string;
  organizationId: string;
  conversationId: string;
  channel: string;
  sequence: number;
  direction: "inbound";
  authorType: "contact";
  contentType: "text";
  body: string;
  externalNamespace: string | null;
  externalId: string | null;
  externalHash: string | null;
  externalHashVersion: number | null;
  occurredAt: Date;
  recordedAt: Timestamp;
}

export interface LeadAssignmentsTable {
  id: string;
  organizationId: string;
  leadId: string;
  assigneeRef: string;
  assignedAt: Timestamp;
  endedAt: Date | null;
}

export interface CommercialEventsTable {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  leadId: string | null;
  eventType: CommercialEventType;
  eventVersion: Generated<number>;
  actorRef: string;
  metadata: JSONColumnType<
    Record<string, string | number | boolean | null>,
    Record<string, string | number | boolean | null>,
    never
  >;
  occurredAt: Timestamp;
  recordedAt: Timestamp;
}

export interface DatabaseSchema {
  organizations: OrganizationsTable;
  foundationJobs: FoundationJobsTable;
  commercialCommands: CommercialCommandsTable;
  companies: CompaniesTable;
  contacts: ContactsTable;
  leads: LeadsTable;
  opportunities: OpportunitiesTable;
  conversations: ConversationsTable;
  messages: MessagesTable;
  leadAssignments: LeadAssignmentsTable;
  commercialEvents: CommercialEventsTable;
}

export type FoundationJobRow = Selectable<FoundationJobsTable>;
export type NewFoundationJobRow = Insertable<FoundationJobsTable>;
export type OrganizationRow = Selectable<OrganizationsTable>;
export type CommercialCommandRow = Selectable<CommercialCommandsTable>;
export type CompanyRow = Selectable<CompaniesTable>;
export type ContactRow = Selectable<ContactsTable>;
export type LeadRow = Selectable<LeadsTable>;
export type OpportunityRow = Selectable<OpportunitiesTable>;
export type ConversationRow = Selectable<ConversationsTable>;
export type MessageRow = Selectable<MessagesTable>;
export type LeadAssignmentRow = Selectable<LeadAssignmentsTable>;
export type CommercialEventRow = Selectable<CommercialEventsTable>;
