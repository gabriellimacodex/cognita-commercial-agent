import { z } from "zod";

export const leadStatusSchema = z.enum(["open", "converted", "closed"]);
export const opportunityStateSchema = z.enum([
  "open",
  "discovery",
  "qualified",
  "proposal",
  "negotiation",
  "nurture",
  "won",
  "lost",
  "disqualified",
]);
export const conversationStatusSchema = z.enum(["open", "closed"]);
export const commercialEventTypeSchema = z.enum([
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
  "commercial_fact_recorded",
  "commercial_fact_conflict_detected",
  "commercial_decision_evaluated",
  "commercial_decision_escalated",
  "commercial_decision_stale",
  "commercial_decision_applied",
]);

const actorRefSchema = z.string().trim().min(1).max(160);
const organizationIdSchema = z.uuid();

export const commercialFactKeySchema = z.enum([
  "company_ownership_type",
  "has_existing_sales_process",
  "uses_crm",
  "seller_count",
  "commercial_owner_defined",
  "has_recurring_inbound",
  "monthly_lead_volume",
  "average_ticket_brl_cents",
  "measures_conversion",
  "roi_provable_within_90_days",
  "sales_cycle_days",
  "pain_confirmed",
  "pain_recurring",
  "pain_measurable",
  "decision_maker_access_confirmed",
  "budget_confirmed",
  "operational_capacity_confirmed",
  "timing_status",
  "revisit_at",
  "nurture_return_condition",
]);

export const commercialRequestedActionSchema = z.enum([
  "create_opportunity",
  "transition_to_discovery",
  "transition_to_qualified",
  "transition_to_proposal",
  "transition_to_negotiation",
  "transition_to_nurture",
  "transition_to_won",
  "transition_to_lost",
  "transition_to_disqualified",
]);

export const commercialDecisionOutcomeSchema = z.enum([
  "allow",
  "block",
  "require_information",
  "require_human_review",
]);

export const commercialAuthorityTypeSchema = z.enum([
  "policy",
  "declared_human",
]);

export const commercialEvidenceSchema = z.object({
  type: z.enum(["message", "commercial_event", "human_attestation"]),
  ref: z.string().trim().min(1).max(255),
});

export const commercialEvaluationReasonCodeSchema = z.enum([
  "conversion_measurement_gap",
  "non_private_profile_requires_review",
  "sales_process_requires_review",
  "seller_count_requires_review",
  "commercial_owner_requires_review",
  "lead_volume_requires_review",
  "average_ticket_requires_review",
  "roi_window_requires_review",
]);

export const commercialTransitionReasonCodeSchema = z.enum([
  "discovery_started",
  "human_qualification_confirmed",
  "proposal_authorized",
  "negotiation_started",
  "nurture_timing_window_pending",
  "nurture_budget_cycle_pending",
  "nurture_decision_process_pending",
  "nurture_operational_capacity_pending",
  "nurture_initiative_paused",
  "commercial_agreement_confirmed",
  "customer_declined",
  "competitor_selected",
  "commercial_terms_not_accepted",
  "budget_lost_after_opportunity",
  "initiative_cancelled",
  "other_human_confirmed",
  "crm_not_used",
  "no_sellers",
  "no_recurring_inbound",
]);

export const commercialHumanReasonCodeSchema = z.union([
  commercialEvaluationReasonCodeSchema,
  commercialTransitionReasonCodeSchema,
]);

export const commercialHumanReasonCodesByAction: Record<
  z.infer<typeof commercialRequestedActionSchema>,
  readonly string[]
> = {
  create_opportunity: commercialEvaluationReasonCodeSchema.options,
  transition_to_discovery: [],
  transition_to_qualified: ["human_qualification_confirmed"],
  transition_to_proposal: ["proposal_authorized"],
  transition_to_negotiation: ["negotiation_started"],
  transition_to_nurture: [
    "nurture_timing_window_pending",
    "nurture_budget_cycle_pending",
    "nurture_decision_process_pending",
    "nurture_operational_capacity_pending",
    "nurture_initiative_paused",
  ],
  transition_to_won: ["commercial_agreement_confirmed"],
  transition_to_lost: [
    "customer_declined",
    "competitor_selected",
    "commercial_terms_not_accepted",
    "budget_lost_after_opportunity",
    "initiative_cancelled",
    "other_human_confirmed",
  ],
  transition_to_disqualified: [
    "crm_not_used",
    "no_sellers",
    "no_recurring_inbound",
  ],
};

export function isCommercialHumanReasonAllowed(
  action: z.infer<typeof commercialRequestedActionSchema>,
  reasonCode: string,
): boolean {
  return commercialHumanReasonCodesByAction[action].includes(reasonCode);
}

const commercialFactValueSchema = z.union([
  z.boolean(),
  z.number().int().nonnegative(),
  z.string().trim().min(1).max(255),
]);

export const createCommercialFactInputSchema = z
  .object({
    organizationId: organizationIdSchema,
    factKey: commercialFactKeySchema,
    factSchemaVersion: z.literal(1),
    value: commercialFactValueSchema,
    sourceType: z.enum(["human_declaration", "domain_record"]),
    sourceRef: z.string().trim().min(1).max(255),
    declarerRef: actorRefSchema,
    executorRef: actorRefSchema,
    observedAt: z.iso.datetime(),
    evidence: commercialEvidenceSchema.optional(),
    correctsFactIds: z.array(z.uuid()).max(100).default([]),
    authorityType: z.literal("declared_human").optional(),
    authorityRef: actorRefSchema.optional(),
  })
  .superRefine((value, context) => {
    const isCorrection = value.correctsFactIds.length > 0;
    if (
      isCorrection &&
      (value.authorityType !== "declared_human" ||
        value.authorityRef == null ||
        value.evidence == null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Fact correction requires declared_human authority and evidence",
      });
    }
    if (
      !isCorrection &&
      (value.authorityType != null || value.authorityRef != null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Human correction authority is only valid for corrections",
      });
    }
  });

export const createCommercialDecisionInputSchema = z
  .object({
    organizationId: organizationIdSchema,
    requestedAction: commercialRequestedActionSchema,
    authorityType: commercialAuthorityTypeSchema.default("policy"),
    authorityRef: actorRefSchema,
    executorRef: actorRefSchema,
    opportunityId: z.uuid().optional(),
    reasonCode: commercialHumanReasonCodeSchema.optional(),
    evidence: commercialEvidenceSchema.optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.requestedAction === "create_opportunity") !==
      (value.opportunityId == null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["opportunityId"],
        message:
          "Opportunity is forbidden for creation decisions and required for transition decisions",
      });
    }
    const expectedPolicy =
      value.requestedAction === "create_opportunity"
        ? "opportunity-eligibility@1.0.0"
        : "commercial-state-gates@1.0.0";
    if (value.authorityType === "policy") {
      if (
        value.authorityRef !== expectedPolicy ||
        value.reasonCode != null ||
        value.evidence != null
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Policy authority must match the requested action and cannot carry human evidence",
        });
      }
      return;
    }
    if (
      value.reasonCode == null ||
      value.evidence == null ||
      !isCommercialHumanReasonAllowed(value.requestedAction, value.reasonCode)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Declared human authority requires action-specific reason and evidence",
      });
    }
  });

const optionalTextSchema = z.string().trim().min(1).max(255).optional();
const externalIdentityFields = {
  externalNamespace: z.string().trim().min(1).max(160).optional(),
  externalId: z.string().trim().min(1).max(255).optional(),
};

function hasCompleteOptionalExternalIdentity(value: {
  externalNamespace?: string | undefined;
  externalId?: string | undefined;
}): boolean {
  return (
    (value.externalNamespace == null && value.externalId == null) ||
    (value.externalNamespace != null && value.externalId != null)
  );
}

export const createOrganizationInputSchema = z.object({
  organizationId: organizationIdSchema,
  name: z.string().trim().min(1).max(200),
  actorRef: actorRefSchema,
});

export const createCompanyInputSchema = z.object({
  organizationId: organizationIdSchema,
  name: z.string().trim().min(1).max(200),
  domain: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/?$/i)
    .optional(),
  cnpj: optionalTextSchema,
  actorRef: actorRefSchema,
});

export const createContactInputSchema = z.object({
  organizationId: organizationIdSchema,
  name: z.string().trim().min(1).max(200),
  email: z.email().max(320).optional(),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(40)
    .regex(/^\+?[0-9 ()-]+$/)
    .optional(),
  companyId: z.uuid().optional(),
  actorRef: actorRefSchema,
});

export const linkContactCompanyInputSchema = z.object({
  organizationId: organizationIdSchema,
  companyId: z.uuid(),
  actorRef: actorRefSchema,
});

export const createLeadInputSchema = z
  .object({
    organizationId: organizationIdSchema,
    contactId: z.uuid(),
    companyId: z.uuid().optional(),
    source: z.string().trim().min(1).max(80),
    ...externalIdentityFields,
    actorRef: actorRefSchema,
  })
  .refine(hasCompleteOptionalExternalIdentity, {
    message: "externalNamespace and externalId must be provided together",
  });

export const linkLeadCompanyInputSchema = z.object({
  organizationId: organizationIdSchema,
  companyId: z.uuid(),
  actorRef: actorRefSchema,
});

export const assignLeadInputSchema = z.object({
  organizationId: organizationIdSchema,
  assigneeRef: z.string().trim().min(1).max(160),
  actorRef: actorRefSchema,
});

export const createConversationInputSchema = z.object({
  organizationId: organizationIdSchema,
  leadId: z.uuid(),
  channel: z.string().trim().min(1).max(80),
  externalNamespace: z.string().trim().min(1).max(160),
  externalThreadId: z.string().trim().min(1).max(255).optional(),
  actorRef: actorRefSchema,
});

export const createMessageInputSchema = z
  .object({
    organizationId: organizationIdSchema,
    body: z.string().min(1).max(10_000),
    occurredAt: z.iso.datetime(),
    ...externalIdentityFields,
    actorRef: actorRefSchema,
  })
  .refine(hasCompleteOptionalExternalIdentity, {
    message: "externalNamespace and externalId must be provided together",
  });

export const createOpportunityInputSchema = z.object({
  organizationId: organizationIdSchema,
  leadId: z.uuid(),
  decisionId: z.uuid(),
  actorRef: actorRefSchema,
});

const transitionReasonCodesByState: Record<
  z.infer<typeof opportunityStateSchema>,
  readonly string[]
> = {
  open: [],
  discovery: ["discovery_started"],
  qualified: ["human_qualification_confirmed"],
  proposal: ["proposal_authorized"],
  negotiation: ["negotiation_started"],
  nurture: [
    "nurture_timing_window_pending",
    "nurture_budget_cycle_pending",
    "nurture_decision_process_pending",
    "nurture_operational_capacity_pending",
    "nurture_initiative_paused",
  ],
  won: ["commercial_agreement_confirmed"],
  lost: [
    "customer_declined",
    "competitor_selected",
    "commercial_terms_not_accepted",
    "budget_lost_after_opportunity",
    "initiative_cancelled",
    "other_human_confirmed",
  ],
  disqualified: ["crm_not_used", "no_sellers", "no_recurring_inbound"],
};

export const transitionOpportunityInputSchema = z
  .object({
    organizationId: organizationIdSchema,
    toState: opportunityStateSchema,
    reasonCode: commercialTransitionReasonCodeSchema,
    decisionId: z.uuid(),
    actorRef: actorRefSchema,
  })
  .superRefine((value, context) => {
    if (
      !transitionReasonCodesByState[value.toState].includes(value.reasonCode)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reasonCode"],
        message: "Reason code is not valid for the target commercial state",
      });
    }
  });

export const commercialFactSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  leadId: z.uuid(),
  factKey: commercialFactKeySchema,
  factSchemaVersion: z.number().int().positive(),
  valueType: z.enum(["boolean", "integer", "string", "timestamp"]),
  value: commercialFactValueSchema,
  sourceType: z.enum(["human_declaration", "domain_record"]),
  sourceRef: z.string(),
  declarerRef: z.string(),
  authorityType: z.literal("declared_human").nullable(),
  authorityRef: z.string().nullable(),
  executorRef: z.string(),
  evidence: commercialEvidenceSchema.nullable(),
  observedAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  active: z.boolean(),
  correctedFactIds: z.array(z.uuid()),
});

export const commercialFactSnapshotSchema = z.object({
  factKey: commercialFactKeySchema,
  factSchemaVersion: z.number().int().positive(),
  status: z.enum(["unknown", "consistent", "conflicting"]),
  value: commercialFactValueSchema.nullable(),
  facts: z.array(commercialFactSchema),
});

export const commercialDecisionSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  leadId: z.uuid(),
  opportunityId: z.uuid().nullable(),
  decisionType: z.string(),
  requestedAction: commercialRequestedActionSchema,
  authorityType: commercialAuthorityTypeSchema,
  authorityRef: z.string(),
  executorRef: z.string(),
  policyKey: z.string(),
  policyVersion: z.string(),
  policyDigest: z.string().regex(/^[0-9a-f]{64}$/),
  decisionSchemaVersion: z.number().int().positive(),
  inputFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  outcome: commercialDecisionOutcomeSchema,
  eligibleActions: z.array(
    z.object({
      action: commercialRequestedActionSchema,
      authorityType: commercialAuthorityTypeSchema,
    }),
  ),
  blockedActions: z.array(
    z.object({
      action: commercialRequestedActionSchema,
      reasonCodes: z.array(z.string()),
    }),
  ),
  missingRequirements: z.array(z.string()),
  requiredEvidence: z.array(z.string()),
  reasonCodes: z.array(z.string()),
  escalationRequired: z.boolean(),
  humanReasonCode: commercialHumanReasonCodeSchema.nullable(),
  humanEvidence: commercialEvidenceSchema.nullable(),
  factIds: z.array(z.uuid()),
  appliedAt: z.iso.datetime().nullable(),
  recordedAt: z.iso.datetime(),
});

const timestampsSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const organizationSchema = timestampsSchema.extend({
  id: z.uuid(),
  name: z.string(),
});
export const companySchema = timestampsSchema.extend({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  domain: z.string().nullable(),
  cnpj: z.string().nullable(),
});
export const contactSchema = timestampsSchema.extend({
  id: z.uuid(),
  organizationId: z.uuid(),
  companyId: z.uuid().nullable(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export const leadSchema = timestampsSchema.extend({
  id: z.uuid(),
  organizationId: z.uuid(),
  contactId: z.uuid(),
  companyId: z.uuid().nullable(),
  source: z.string(),
  status: leadStatusSchema,
  externalNamespace: z.string().nullable(),
  externalId: z.string().nullable(),
  closedAt: z.iso.datetime().nullable(),
  convertedAt: z.iso.datetime().nullable(),
});
export const opportunitySchema = timestampsSchema.extend({
  id: z.uuid(),
  organizationId: z.uuid(),
  leadId: z.uuid(),
  commercialState: opportunityStateSchema,
  lastTransitionReasonCode: z.string().nullable(),
});
export const commercialDecisionContextSchema = z.object({
  lead: leadSchema,
  contact: contactSchema,
  opportunity: opportunitySchema.nullable(),
  facts: z.array(commercialFactSnapshotSchema),
  latestDecision: commercialDecisionSchema.nullable(),
});
export const conversationSchema = timestampsSchema.extend({
  id: z.uuid(),
  organizationId: z.uuid(),
  leadId: z.uuid(),
  contactId: z.uuid(),
  channel: z.string(),
  externalNamespace: z.string(),
  externalThreadId: z.string().nullable(),
  status: conversationStatusSchema,
  closedAt: z.iso.datetime().nullable(),
});
export const messageSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  conversationId: z.uuid(),
  sequence: z.number().int().positive(),
  direction: z.literal("inbound"),
  authorType: z.literal("contact"),
  contentType: z.literal("text"),
  body: z.string(),
  externalNamespace: z.string().nullable(),
  externalId: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
});
export const leadAssignmentSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  leadId: z.uuid(),
  assigneeRef: z.string(),
  assignedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});

const eventMetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export const commercialEventSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  subjectType: z.string(),
  subjectId: z.uuid(),
  leadId: z.uuid().nullable(),
  eventType: commercialEventTypeSchema,
  eventVersion: z.number().int().positive(),
  actorRef: z.string(),
  metadata: z.record(z.string(), eventMetadataValueSchema),
  occurredAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
});

export const commercialCommandReceiptSchema = z.object({
  commandId: z.uuid(),
  commandType: z.string(),
  targetType: z.string(),
  targetId: z.uuid().nullable(),
  eventId: z.uuid().nullable(),
  resultCode: z.string(),
  httpStatus: z.number().int().min(100).max(599),
  schemaVersion: z.number().int().positive(),
  completedAt: z.iso.datetime(),
});

export const leadContextSchema = z.object({
  lead: leadSchema,
  contact: contactSchema,
  company: companySchema.nullable(),
  assignment: leadAssignmentSchema.nullable(),
  opportunity: opportunitySchema.nullable(),
  conversations: z.array(
    z.object({
      conversation: conversationSchema,
      messages: z.array(messageSchema),
    }),
  ),
});

export const commercialTimelineSchema = z.object({
  items: z.array(commercialEventSchema),
  nextCursor: z.uuid().nullable(),
});

export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type OpportunityState = z.infer<typeof opportunityStateSchema>;
export type CommercialEventType = z.infer<typeof commercialEventTypeSchema>;
export type CommercialFactKey = z.infer<typeof commercialFactKeySchema>;
export type CommercialRequestedAction = z.infer<
  typeof commercialRequestedActionSchema
>;
export type CommercialDecisionOutcome = z.infer<
  typeof commercialDecisionOutcomeSchema
>;
export type CommercialAuthorityType = z.infer<
  typeof commercialAuthorityTypeSchema
>;
export type CommercialEvidence = z.infer<typeof commercialEvidenceSchema>;
export type CommercialHumanReasonCode = z.infer<
  typeof commercialHumanReasonCodeSchema
>;
export type CreateCommercialFactInput = z.infer<
  typeof createCommercialFactInputSchema
>;
export type CreateCommercialDecisionInput = z.infer<
  typeof createCommercialDecisionInputSchema
>;
export type CreateOrganizationInput = z.infer<
  typeof createOrganizationInputSchema
>;
export type CreateCompanyInput = z.infer<typeof createCompanyInputSchema>;
export type CreateContactInput = z.infer<typeof createContactInputSchema>;
export type LinkContactCompanyInput = z.infer<
  typeof linkContactCompanyInputSchema
>;
export type CreateLeadInput = z.infer<typeof createLeadInputSchema>;
export type LinkLeadCompanyInput = z.infer<typeof linkLeadCompanyInputSchema>;
export type AssignLeadInput = z.infer<typeof assignLeadInputSchema>;
export type CreateConversationInput = z.infer<
  typeof createConversationInputSchema
>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type CreateOpportunityInput = z.infer<
  typeof createOpportunityInputSchema
>;
export type TransitionOpportunityInput = z.infer<
  typeof transitionOpportunityInputSchema
>;
export type Organization = z.infer<typeof organizationSchema>;
export type Company = z.infer<typeof companySchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Lead = z.infer<typeof leadSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type LeadAssignment = z.infer<typeof leadAssignmentSchema>;
export type CommercialEvent = z.infer<typeof commercialEventSchema>;
export type CommercialCommandReceipt = z.infer<
  typeof commercialCommandReceiptSchema
>;
export type LeadContext = z.infer<typeof leadContextSchema>;
export type CommercialTimeline = z.infer<typeof commercialTimelineSchema>;
export type CommercialFact = z.infer<typeof commercialFactSchema>;
export type CommercialFactSnapshot = z.infer<
  typeof commercialFactSnapshotSchema
>;
export type CommercialDecision = z.infer<typeof commercialDecisionSchema>;
export type CommercialDecisionContext = z.infer<
  typeof commercialDecisionContextSchema
>;
