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
]);

const actorRefSchema = z.string().trim().min(1).max(160);
const organizationIdSchema = z.uuid();
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
  actorRef: actorRefSchema,
});

export const transitionOpportunityInputSchema = z.object({
  organizationId: organizationIdSchema,
  toState: opportunityStateSchema,
  reasonCode: z.string().trim().min(1).max(80),
  actorRef: actorRefSchema,
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
