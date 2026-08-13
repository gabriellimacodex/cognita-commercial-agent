import type {
  CommercialDecisionOutcome,
  CommercialFactKey,
  CommercialHumanReasonCode,
  CommercialRequestedAction,
  CommercialRequirementId,
  ProviderFactCandidate,
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

export interface CommercialFactsTable {
  id: string;
  organizationId: string;
  leadId: string;
  factKey: CommercialFactKey;
  factSchemaVersion: number;
  valueType: "boolean" | "integer" | "string" | "timestamp";
  value: ColumnType<unknown, string, never>;
  sourceType: "human_declaration" | "domain_record";
  sourceRef: string;
  declarerRef: string;
  authorityType: "declared_human" | null;
  authorityRef: string | null;
  executorRef: string;
  evidenceType: "message" | "commercial_event" | "human_attestation" | null;
  evidenceRef: string | null;
  observedAt: Date;
  recordedAt: Timestamp;
}

export interface CommercialFactCorrectionsTable {
  correctiveFactId: string;
  correctedFactId: string;
  organizationId: string;
  createdAt: Timestamp;
}

export interface CommercialDecisionsTable {
  id: string;
  organizationId: string;
  leadId: string;
  opportunityId: string | null;
  decisionType: string;
  requestedAction: CommercialRequestedAction;
  authorityType: "policy" | "declared_human";
  authorityRef: string;
  executorRef: string;
  policyKey: string;
  policyVersion: string;
  policyDigest: string;
  decisionSchemaVersion: number;
  inputFingerprint: string;
  inputSnapshot: JSONColumnType<Record<string, unknown>, string, never>;
  outcome: CommercialDecisionOutcome;
  eligibleActions: JSONColumnType<
    Array<{
      action: CommercialRequestedAction;
      authorityType: "policy" | "declared_human";
    }>,
    string,
    never
  >;
  blockedActions: JSONColumnType<
    Array<{ action: CommercialRequestedAction; reasonCodes: string[] }>,
    string,
    never
  >;
  missingRequirements: JSONColumnType<CommercialRequirementId[], string, never>;
  requiredEvidence: JSONColumnType<string[], string, never>;
  reasonCodes: JSONColumnType<string[], string, never>;
  escalationRequired: boolean;
  humanReasonCode: CommercialHumanReasonCode | null;
  humanEvidenceType:
    "message" | "commercial_event" | "human_attestation" | null;
  humanEvidenceRef: string | null;
  recordedAt: Timestamp;
}

export interface CommercialDecisionFactsTable {
  organizationId: string;
  decisionId: string;
  factId: string;
  factKey: CommercialFactKey;
  createdAt: Timestamp;
}

export interface CommercialDecisionApplicationsTable {
  id: string;
  organizationId: string;
  decisionId: string;
  commandId: string;
  targetType: string;
  targetId: string;
  appliedAt: Timestamp;
}

export interface CommercialInterpretationRunsTable {
  id: string;
  organizationId: string;
  leadId: string;
  conversationId: string;
  messageId: string;
  status: Generated<"running" | "completed" | "failed">;
  idempotencyKey: string;
  requestHash: string;
  providerId: "openai";
  modelId: "gpt-5.6-terra";
  returnedModelId: "gpt-5.6-terra" | null;
  instructionKey: string;
  instructionVersion: string;
  instructionDigest: string;
  outputSchemaVersion: number;
  outputSchemaDigest: string;
  invocationConfig: JSONColumnType<
    {
      endpoint: "https://api.openai.com/v1/responses";
      reasoningEffort: "none";
      maxOutputTokens: 1200;
      store: false;
      background: false;
      tools: false;
      timeoutMs: 20000;
      automaticRetries: 0;
      fallback: false;
    },
    string,
    never
  >;
  providerRequestId: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  outputDigest: string | null;
  failureCode:
    "provider_timeout" | "provider_error" | "invalid_structured_output" | null;
  reprocessesRunId: string | null;
  startedAt: Timestamp;
  completedAt: Date | null;
  failedAt: Date | null;
}

export interface CommercialFactCandidatesTable {
  id: string;
  organizationId: string;
  leadId: string;
  interpretationRunId: string;
  messageId: string;
  factKey: CommercialFactKey;
  factSchemaVersion: number;
  valueType: "boolean" | "integer" | "string" | "timestamp" | null;
  proposedValue: ColumnType<unknown, string | null, never>;
  classification: "reviewable" | "ambiguous" | "invalid" | "duplicate";
  ambiguityCode: ProviderFactCandidate["ambiguityCode"];
  ambiguityDetails: JSONColumnType<
    {
      minimum: number | null;
      maximum: number | null;
      note: string | null;
    } | null,
    string | null,
    never
  >;
  validationCode: string | null;
  duplicateOfCandidateId: string | null;
  createdAt: Timestamp;
}

export interface CommercialEvidenceSpansTable {
  id: string;
  organizationId: string;
  candidateId: string;
  messageId: string;
  evidenceType: "message_text_span";
  startOffset: number;
  endOffset: number;
  spanDigest: string;
  createdAt: Timestamp;
}

export interface CommercialCandidateResolutionsTable {
  id: string;
  organizationId: string;
  candidateId: string;
  resolutionType: "confirmed" | "rejected";
  confirmationMode: "assert" | "correct" | null;
  rejectionReasonCode: string | null;
  authorityType: "declared_human";
  authorityRef: string;
  executorRef: string;
  commercialFactId: string | null;
  resolvedAt: Timestamp;
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
  commercialFacts: CommercialFactsTable;
  commercialFactCorrections: CommercialFactCorrectionsTable;
  commercialDecisions: CommercialDecisionsTable;
  commercialDecisionFacts: CommercialDecisionFactsTable;
  commercialDecisionApplications: CommercialDecisionApplicationsTable;
  commercialInterpretationRuns: CommercialInterpretationRunsTable;
  commercialFactCandidates: CommercialFactCandidatesTable;
  commercialEvidenceSpans: CommercialEvidenceSpansTable;
  commercialCandidateResolutions: CommercialCandidateResolutionsTable;
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
export type CommercialFactRow = Selectable<CommercialFactsTable>;
export type CommercialDecisionRow = Selectable<CommercialDecisionsTable>;
export type CommercialInterpretationRunRow =
  Selectable<CommercialInterpretationRunsTable>;
export type CommercialFactCandidateRow =
  Selectable<CommercialFactCandidatesTable>;
export type CommercialEvidenceSpanRow =
  Selectable<CommercialEvidenceSpansTable>;
export type CommercialCandidateResolutionRow =
  Selectable<CommercialCandidateResolutionsTable>;
