import type { FastifyReply, FastifyRequest } from "fastify";
import { z, type ZodType } from "zod";

import {
  assignLeadInputSchema,
  applyCommercialActionCandidateInputSchema,
  commercialActionPlanSchema,
  commercialCommandReceiptSchema,
  commercialDecisionContextSchema,
  commercialDecisionSchema,
  commercialFactSnapshotSchema,
  factCandidateSchema,
  interpretationRunSchema,
  questionCandidateSchema,
  commercialTimelineSchema,
  companySchema,
  contactSchema,
  conversationSchema,
  createCompanyInputSchema,
  createCommercialDecisionInputSchema,
  createCommercialActionPlanInputSchema,
  createCommercialFactInputSchema,
  createContactInputSchema,
  createConversationInputSchema,
  createLeadInputSchema,
  createMessageInputSchema,
  createOpportunityInputSchema,
  createOrganizationInputSchema,
  leadContextSchema,
  leadSchema,
  linkContactCompanyInputSchema,
  linkLeadCompanyInputSchema,
  opportunitySchema,
  organizationSchema,
  transitionOpportunityInputSchema,
  startInterpretationInputSchema,
  confirmFactCandidateInputSchema,
  rejectFactCandidateInputSchema,
  evaluateCommercialActionCandidateInputSchema,
} from "@cognita/schemas";

import type { CommercialService } from "./commercial-service.js";
import type { CommercialInterpretationService } from "./commercial-interpretation-service.js";

const idempotencyKeySchema = z.string().trim().min(1).max(255);
const idParamsSchema = z.object({ id: z.uuid() });
const organizationQuerySchema = z.object({ organizationId: z.uuid() });
const timelineQuerySchema = organizationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
});

function validationError(
  request: FastifyRequest,
  reply: FastifyReply,
  code: string,
): void {
  void reply.status(400).send({
    error: {
      code,
      message: "Request does not match the commercial contract",
      requestId: request.id,
    },
  });
}

function parseCommand<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ZodType<T>,
): { input: T; idempotencyKey: string } | undefined {
  const input = schema.safeParse(request.body);
  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers["idempotency-key"],
  );
  if (!input.success || !idempotencyKey.success) {
    validationError(request, reply, "INVALID_COMMERCIAL_COMMAND");
    return undefined;
  }
  return { input: input.data, idempotencyKey: idempotencyKey.data };
}

function parseId(
  request: FastifyRequest,
  reply: FastifyReply,
): string | undefined {
  const result = idParamsSchema.safeParse(request.params);
  if (!result.success) {
    validationError(request, reply, "INVALID_RESOURCE_ID");
    return undefined;
  }
  return result.data.id;
}

export class CommercialHandler {
  public constructor(
    private readonly service: CommercialService,
    private readonly interpretationService?: CommercialInterpretationService,
  ) {}

  public startInterpretation = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(request, reply, startInterpretationInputSchema);
    if (id == null || parsed == null || this.interpretationService == null)
      return;
    const run = await this.interpretationService.start(
      id,
      parsed.input,
      parsed.idempotencyKey,
      request.id,
    );
    await reply
      .status(run.status === "running" ? 202 : 200)
      .send(interpretationRunSchema.parse(run));
  };

  public getInterpretation = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const query = organizationQuerySchema.safeParse(request.query);
    if (id == null || !query.success || this.interpretationService == null) {
      if (!query.success)
        validationError(request, reply, "INVALID_ORGANIZATION_QUERY");
      return;
    }
    await reply.send(
      interpretationRunSchema.parse(
        await this.interpretationService.get(query.data.organizationId, id),
      ),
    );
  };

  public listInterpretations = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const query = organizationQuerySchema.safeParse(request.query);
    if (id == null || !query.success || this.interpretationService == null) {
      if (!query.success)
        validationError(request, reply, "INVALID_ORGANIZATION_QUERY");
      return;
    }
    await reply.send(
      z
        .array(interpretationRunSchema)
        .parse(
          await this.interpretationService.list(query.data.organizationId, id),
        ),
    );
  };

  public confirmCandidate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(
      request,
      reply,
      confirmFactCandidateInputSchema,
    );
    if (id == null || parsed == null || this.interpretationService == null)
      return;
    await reply.send(
      factCandidateSchema.parse(
        await this.interpretationService.confirm(
          id,
          parsed.input,
          parsed.idempotencyKey,
        ),
      ),
    );
  };

  public rejectCandidate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(request, reply, rejectFactCandidateInputSchema);
    if (id == null || parsed == null || this.interpretationService == null)
      return;
    await reply.send(
      factCandidateSchema.parse(
        await this.interpretationService.reject(
          id,
          parsed.input,
          parsed.idempotencyKey,
        ),
      ),
    );
  };

  public listQuestionCandidates = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const query = organizationQuerySchema.safeParse(request.query);
    if (id == null || !query.success || this.interpretationService == null) {
      if (!query.success)
        validationError(request, reply, "INVALID_ORGANIZATION_QUERY");
      return;
    }
    await reply.send(
      z
        .array(questionCandidateSchema)
        .parse(
          await this.interpretationService.questionCandidates(
            query.data.organizationId,
            id,
          ),
        ),
    );
  };

  public createOrganization = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const parsed = parseCommand(request, reply, createOrganizationInputSchema);
    if (parsed == null) return;
    const result = await this.service.createOrganization(
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply
      .status(result.receipt.httpStatus)
      .send(commercialCommandReceiptSchema.parse(result.receipt));
  };

  public recordFact = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(
      request,
      reply,
      createCommercialFactInputSchema,
    );
    if (id == null || parsed == null) return;
    const result = await this.service.recordFact(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply
      .status(result.receipt.httpStatus)
      .send(commercialCommandReceiptSchema.parse(result.receipt));
  };

  public evaluateDecision = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(
      request,
      reply,
      createCommercialDecisionInputSchema,
    );
    if (id == null || parsed == null) return;
    const result = await this.service.evaluateDecision(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(201).send(commercialDecisionSchema.parse(result));
  };

  public planAction = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(
      request,
      reply,
      createCommercialActionPlanInputSchema,
    );
    if (id == null || parsed == null) return;
    await reply
      .status(201)
      .send(
        commercialActionPlanSchema.parse(
          await this.service.planAction(
            id,
            parsed.input,
            parsed.idempotencyKey,
          ),
        ),
      );
  };

  public getActionPlan = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const query = organizationQuerySchema.safeParse(request.query);
    if (id == null || !query.success) {
      if (!query.success)
        validationError(request, reply, "INVALID_ORGANIZATION_QUERY");
      return;
    }
    await reply.send(
      commercialActionPlanSchema.parse(
        await this.service.getActionPlan(query.data.organizationId, id),
      ),
    );
  };

  public evaluateActionCandidate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(
      request,
      reply,
      evaluateCommercialActionCandidateInputSchema,
    );
    if (id == null || parsed == null) return;
    await reply
      .status(201)
      .send(
        commercialDecisionSchema.parse(
          await this.service.evaluateActionCandidate(
            id,
            parsed.input,
            parsed.idempotencyKey,
          ),
        ),
      );
  };

  public applyActionCandidate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(
      request,
      reply,
      applyCommercialActionCandidateInputSchema,
    );
    if (id == null || parsed == null) return;
    const result = await this.service.applyActionCandidate(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply
      .status(result.receipt.httpStatus)
      .send(commercialCommandReceiptSchema.parse(result.receipt));
  };

  public createCompany = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const parsed = parseCommand(request, reply, createCompanyInputSchema);
    if (parsed == null) return;
    const result = await this.service.createCompany(
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public createContact = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const parsed = parseCommand(request, reply, createContactInputSchema);
    if (parsed == null) return;
    const result = await this.service.createContact(
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public linkContactCompany = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(request, reply, linkContactCompanyInputSchema);
    if (id == null || parsed == null) return;
    const result = await this.service.linkContactCompany(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public createLead = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const parsed = parseCommand(request, reply, createLeadInputSchema);
    if (parsed == null) return;
    const result = await this.service.createLead(
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public linkLeadCompany = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(request, reply, linkLeadCompanyInputSchema);
    if (id == null || parsed == null) return;
    const result = await this.service.linkLeadCompany(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public assignLead = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(request, reply, assignLeadInputSchema);
    if (id == null || parsed == null) return;
    const result = await this.service.assignLead(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public createConversation = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const parsed = parseCommand(request, reply, createConversationInputSchema);
    if (parsed == null) return;
    const result = await this.service.createConversation(
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public createMessage = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(request, reply, createMessageInputSchema);
    if (id == null || parsed == null) return;
    const result = await this.service.createMessage(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public createOpportunity = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const parsed = parseCommand(request, reply, createOpportunityInputSchema);
    if (parsed == null) return;
    const result = await this.service.createOpportunity(
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public transitionOpportunity = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const parsed = parseCommand(
      request,
      reply,
      transitionOpportunityInputSchema,
    );
    if (id == null || parsed == null) return;
    const result = await this.service.transitionOpportunity(
      id,
      parsed.input,
      parsed.idempotencyKey,
    );
    await reply.status(result.receipt.httpStatus).send(result.receipt);
  };

  public getOrganization = this.readWithoutOrganization(
    (id) => this.service.getOrganization(id),
    organizationSchema,
  );
  public getCompany = this.readWithOrganization(
    (organizationId, id) => this.service.getCompany(organizationId, id),
    companySchema,
  );
  public getContact = this.readWithOrganization(
    (organizationId, id) => this.service.getContact(organizationId, id),
    contactSchema,
  );
  public getLead = this.readWithOrganization(
    (organizationId, id) => this.service.getLead(organizationId, id),
    leadSchema,
  );
  public getConversation = this.readWithOrganization(
    (organizationId, id) => this.service.getConversation(organizationId, id),
    conversationSchema,
  );
  public getOpportunity = this.readWithOrganization(
    (organizationId, id) => this.service.getOpportunity(organizationId, id),
    opportunitySchema,
  );
  public getLeadContext = this.readWithOrganization(
    (organizationId, id) => this.service.getLeadContext(organizationId, id),
    leadContextSchema,
  );
  public listFacts = this.readWithOrganization(
    (organizationId, id) => this.service.listFacts(organizationId, id),
    z.array(commercialFactSnapshotSchema),
  );
  public getDecision = this.readWithOrganization(
    (organizationId, id) => this.service.getDecision(organizationId, id),
    commercialDecisionSchema,
  );
  public getDecisionContext = this.readWithOrganization(
    (organizationId, id) => this.service.getDecisionContext(organizationId, id),
    commercialDecisionContextSchema,
  );

  public getLeadTimeline = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = parseId(request, reply);
    const query = timelineQuerySchema.safeParse(request.query);
    if (id == null || !query.success) {
      if (id != null)
        validationError(request, reply, "INVALID_COMMERCIAL_QUERY");
      return;
    }
    const result = await this.service.getLeadTimeline(
      query.data.organizationId,
      id,
      query.data.limit,
      query.data.cursor,
    );
    await reply.send(commercialTimelineSchema.parse(result));
  };

  private readWithoutOrganization<T>(
    load: (id: string) => Promise<T>,
    schema: ZodType<T>,
  ) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      const id = parseId(request, reply);
      if (id == null) return;
      await reply.send(schema.parse(await load(id)));
    };
  }

  private readWithOrganization<T>(
    load: (organizationId: string, id: string) => Promise<T>,
    schema: ZodType<T>,
  ) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      const id = parseId(request, reply);
      const query = organizationQuerySchema.safeParse(request.query);
      if (id == null || !query.success) {
        if (id != null)
          validationError(request, reply, "INVALID_COMMERCIAL_QUERY");
        return;
      }
      await reply.send(schema.parse(await load(query.data.organizationId, id)));
    };
  }
}
