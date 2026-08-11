import { randomUUID } from "node:crypto";

import {
  type CommercialDecisionRepository,
  CommercialNotFoundError,
  type CommandResult,
  type CommercialCommandExecution,
  type CommercialRepository,
} from "@cognita/database";
import type { Logger } from "@cognita/observability";
import type {
  AssignLeadInput,
  CommercialDecision,
  CommercialDecisionContext,
  CommercialFactSnapshot,
  CommercialTimeline,
  Company,
  Contact,
  Conversation,
  CreateCompanyInput,
  CreateCommercialDecisionInput,
  CreateCommercialFactInput,
  CreateContactInput,
  CreateConversationInput,
  CreateLeadInput,
  CreateMessageInput,
  CreateOpportunityInput,
  CreateOrganizationInput,
  Lead,
  LeadContext,
  LinkContactCompanyInput,
  LinkLeadCompanyInput,
  Opportunity,
  Organization,
  TransitionOpportunityInput,
} from "@cognita/schemas";

import {
  assertOpportunityTransition,
  hashCanonical,
  hashCommercialCommand,
  normalizeCnpj,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
} from "./commercial-domain.js";
import { evaluateCommercialDecision } from "./commercial-decision-engine.js";
import { validateCommercialFact } from "./commercial-fact-catalog.js";

function command(
  organizationId: string,
  commandType: string,
  idempotencyKey: string,
  routeParameters: Record<string, string>,
  body: unknown,
  actorRef: string,
  targetType: string,
  successCode: string,
  successHttpStatus = 201,
): CommercialCommandExecution {
  return {
    organizationId,
    commandType,
    idempotencyKey,
    requestHash: hashCommercialCommand(
      organizationId,
      commandType,
      routeParameters,
      body,
      actorRef,
    ),
    targetType,
    successCode,
    successHttpStatus,
  };
}

export class CommercialService {
  public constructor(
    private readonly repository: CommercialRepository,
    private readonly decisionRepository: CommercialDecisionRepository,
    private readonly logger: Logger,
  ) {}

  public async recordFact(
    leadId: string,
    input: CreateCommercialFactInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    const valueType = validateCommercialFact(input);
    const semantic = {
      leadId,
      factKey: input.factKey,
      factSchemaVersion: input.factSchemaVersion,
      value: input.value,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      declarerRef: input.declarerRef,
      executorRef: input.executorRef,
      observedAt: input.observedAt,
      evidence: input.evidence ?? null,
      correctsFactIds: [...input.correctsFactIds].sort(),
      authorityType: input.authorityType ?? null,
      authorityRef: input.authorityRef ?? null,
    };
    const result = await this.decisionRepository.createFact(
      command(
        input.organizationId,
        "record_commercial_fact_v1",
        idempotencyKey,
        { leadId },
        semantic,
        input.executorRef,
        "commercial_fact",
        "COMMERCIAL_FACT_RECORDED",
      ),
      {
        id: randomUUID(),
        organizationId: input.organizationId,
        leadId,
        factKey: input.factKey,
        factSchemaVersion: input.factSchemaVersion,
        valueType,
        value: input.value,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        declarerRef: input.declarerRef,
        authorityType: input.authorityType ?? null,
        authorityRef: input.authorityRef ?? null,
        executorRef: input.executorRef,
        evidenceType: input.evidence?.type ?? null,
        evidenceRef: input.evidence?.ref ?? null,
        observedAt: new Date(input.observedAt),
        correctsFactIds: input.correctsFactIds,
      },
    );
    this.logger.info(
      {
        event: result.replayed
          ? "commercial_fact_replayed"
          : "commercial_fact_recorded",
        organizationId: input.organizationId,
        leadId,
        factId: result.receipt.targetId,
        factKey: input.factKey,
      },
      result.replayed ? "Commercial Fact replayed" : "Commercial Fact recorded",
    );
    return this.report(result);
  }

  public listFacts(
    organizationId: string,
    leadId: string,
  ): Promise<CommercialFactSnapshot[]> {
    return this.decisionRepository.listFacts(organizationId, leadId);
  }

  public async evaluateDecision(
    leadId: string,
    input: CreateCommercialDecisionInput,
    idempotencyKey: string,
  ): Promise<CommercialDecision> {
    const result = await this.decisionRepository.createDecision(
      command(
        input.organizationId,
        "evaluate_commercial_decision_v1",
        idempotencyKey,
        { leadId },
        input,
        input.executorRef,
        "commercial_decision",
        "COMMERCIAL_DECISION_EVALUATED",
      ),
      leadId,
      input,
      evaluateCommercialDecision,
    );
    this.report(result);
    const decision =
      result.receipt.targetId == null
        ? undefined
        : await this.decisionRepository.findDecision(
            input.organizationId,
            result.receipt.targetId,
          );
    if (decision == null) throw new CommercialNotFoundError("Decision");
    this.logger.info(
      {
        event: result.replayed
          ? "commercial_decision_replayed"
          : decision.escalationRequired
            ? "commercial_decision_escalated"
            : "commercial_decision_evaluated",
        organizationId: input.organizationId,
        leadId,
        decisionId: decision.id,
        requestedAction: decision.requestedAction,
        outcome: decision.outcome,
        policyKey: decision.policyKey,
        policyVersion: decision.policyVersion,
      },
      result.replayed
        ? "Commercial Decision replayed"
        : "Commercial Decision evaluated",
    );
    return decision;
  }

  public async getDecision(
    organizationId: string,
    decisionId: string,
  ): Promise<CommercialDecision> {
    const decision = await this.decisionRepository.findDecision(
      organizationId,
      decisionId,
    );
    if (decision == null) throw new CommercialNotFoundError("Decision");
    return decision;
  }

  public getDecisionContext(
    organizationId: string,
    leadId: string,
  ): Promise<CommercialDecisionContext> {
    return this.decisionRepository.getDecisionContext(organizationId, leadId);
  }

  public async createOrganization(
    input: CreateOrganizationInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    return this.report(
      await this.repository.createOrganization(
        command(
          input.organizationId,
          "create_organization_v1",
          idempotencyKey,
          {},
          { name: input.name },
          input.actorRef,
          "organization",
          "ORGANIZATION_CREATED",
        ),
        { id: input.organizationId, name: input.name },
      ),
    );
  }

  public async createCompany(
    input: CreateCompanyInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    const normalizedDomain = normalizeDomain(input.domain);
    const cnpjDigits = normalizeCnpj(input.cnpj);
    const semantic = {
      name: input.name,
      normalizedDomain,
      cnpjDigits,
    };
    return this.report(
      await this.repository.createCompany(
        command(
          input.organizationId,
          "create_company_v1",
          idempotencyKey,
          {},
          semantic,
          input.actorRef,
          "company",
          "COMPANY_CREATED",
        ),
        { id: randomUUID(), ...semantic },
        input.actorRef,
      ),
    );
  }

  public async createContact(
    input: CreateContactInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    const semantic = {
      name: input.name,
      normalizedEmail: normalizeEmail(input.email),
      normalizedPhone: normalizePhone(input.phone),
      companyId: input.companyId ?? null,
    };
    return this.report(
      await this.repository.createContact(
        command(
          input.organizationId,
          "create_contact_v1",
          idempotencyKey,
          {},
          semantic,
          input.actorRef,
          "contact",
          "CONTACT_CREATED",
        ),
        { id: randomUUID(), ...semantic },
        input.actorRef,
      ),
    );
  }

  public async linkContactCompany(
    contactId: string,
    input: LinkContactCompanyInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    return this.report(
      await this.repository.linkContactCompany(
        command(
          input.organizationId,
          "link_contact_company_v1",
          idempotencyKey,
          { contactId },
          { companyId: input.companyId },
          input.actorRef,
          "contact",
          "CONTACT_LINKED",
          200,
        ),
        contactId,
        input.companyId,
        input.actorRef,
      ),
    );
  }

  public async createLead(
    input: CreateLeadInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    const semantic = {
      contactId: input.contactId,
      companyId: input.companyId ?? null,
      source: input.source,
      externalNamespace: input.externalNamespace ?? null,
      externalId: input.externalId ?? null,
    };
    return this.report(
      await this.repository.createLead(
        command(
          input.organizationId,
          "create_lead_v1",
          idempotencyKey,
          {},
          semantic,
          input.actorRef,
          "lead",
          "LEAD_CREATED",
        ),
        {
          id: randomUUID(),
          ...semantic,
          externalHash:
            semantic.externalId == null
              ? null
              : hashCanonical({ version: 1, ...semantic }),
        },
        input.actorRef,
      ),
    );
  }

  public async linkLeadCompany(
    leadId: string,
    input: LinkLeadCompanyInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    return this.report(
      await this.repository.linkLeadCompany(
        command(
          input.organizationId,
          "link_lead_company_v1",
          idempotencyKey,
          { leadId },
          { companyId: input.companyId },
          input.actorRef,
          "lead",
          "LEAD_COMPANY_LINKED",
          200,
        ),
        leadId,
        input.companyId,
        input.actorRef,
      ),
    );
  }

  public async assignLead(
    leadId: string,
    input: AssignLeadInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    return this.report(
      await this.repository.assignLead(
        command(
          input.organizationId,
          "assign_lead_v1",
          idempotencyKey,
          { leadId },
          { assigneeRef: input.assigneeRef },
          input.actorRef,
          "lead_assignment",
          "LEAD_ASSIGNED",
        ),
        leadId,
        randomUUID(),
        input.assigneeRef,
        input.actorRef,
      ),
    );
  }

  public async createConversation(
    input: CreateConversationInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    const semantic = {
      leadId: input.leadId,
      channel: input.channel,
      externalNamespace: input.externalNamespace,
      externalThreadId: input.externalThreadId ?? null,
    };
    return this.report(
      await this.repository.createConversation(
        command(
          input.organizationId,
          "create_conversation_v1",
          idempotencyKey,
          {},
          semantic,
          input.actorRef,
          "conversation",
          "CONVERSATION_STARTED",
        ),
        {
          id: randomUUID(),
          ...semantic,
          externalHash:
            semantic.externalThreadId == null
              ? null
              : hashCanonical({ version: 1, ...semantic }),
        },
        input.actorRef,
      ),
    );
  }

  public async createMessage(
    conversationId: string,
    input: CreateMessageInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    const semantic = {
      body: input.body,
      occurredAt: input.occurredAt,
      externalNamespace: input.externalNamespace ?? null,
      externalId: input.externalId ?? null,
    };
    return this.report(
      await this.repository.createMessage(
        command(
          input.organizationId,
          "create_inbound_message_v1",
          idempotencyKey,
          { conversationId },
          semantic,
          input.actorRef,
          "message",
          "MESSAGE_RECEIVED",
        ),
        conversationId,
        {
          id: randomUUID(),
          ...semantic,
          occurredAt: new Date(input.occurredAt),
          externalHash:
            semantic.externalId == null
              ? null
              : hashCanonical({ version: 1, conversationId, ...semantic }),
        },
        input.actorRef,
      ),
    );
  }

  public async createOpportunity(
    input: CreateOpportunityInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    return this.report(
      await this.repository.createOpportunity(
        command(
          input.organizationId,
          "create_opportunity_v1",
          idempotencyKey,
          {},
          { leadId: input.leadId, decisionId: input.decisionId },
          input.actorRef,
          "opportunity",
          "OPPORTUNITY_CREATED",
        ),
        randomUUID(),
        input.leadId,
        input.decisionId,
        input.actorRef,
        evaluateCommercialDecision,
      ),
    );
  }

  public async transitionOpportunity(
    opportunityId: string,
    input: TransitionOpportunityInput,
    idempotencyKey: string,
  ): Promise<CommandResult> {
    const result = await this.repository.transitionOpportunity(
      command(
        input.organizationId,
        "transition_opportunity_v1",
        idempotencyKey,
        { opportunityId },
        {
          toState: input.toState,
          reasonCode: input.reasonCode,
          decisionId: input.decisionId,
        },
        input.actorRef,
        "opportunity",
        "OPPORTUNITY_STATE_TRANSITIONED",
        200,
      ),
      opportunityId,
      input.toState,
      input.reasonCode,
      input.decisionId,
      input.actorRef,
      assertOpportunityTransition,
      evaluateCommercialDecision,
    );
    if (result.transition != null) {
      this.logger.info(
        {
          event: "commercial_state_transitioned",
          organizationId: input.organizationId,
          opportunityId,
          fromState: result.transition.fromState,
          toState: result.transition.toState,
        },
        "Commercial state transitioned",
      );
    }
    return this.report(result);
  }

  public async getOrganization(id: string): Promise<Organization> {
    const result = await this.repository.findOrganization(id);
    if (result == null) throw new CommercialNotFoundError("Organization");
    return result;
  }

  public async getCompany(
    organizationId: string,
    id: string,
  ): Promise<Company> {
    const result = await this.repository.findCompany(organizationId, id);
    if (result == null) throw new CommercialNotFoundError("Company");
    return result;
  }

  public async getContact(
    organizationId: string,
    id: string,
  ): Promise<Contact> {
    const result = await this.repository.findContact(organizationId, id);
    if (result == null) throw new CommercialNotFoundError("Contact");
    return result;
  }

  public async getLead(organizationId: string, id: string): Promise<Lead> {
    const result = await this.repository.findLead(organizationId, id);
    if (result == null) throw new CommercialNotFoundError("Lead");
    return result;
  }

  public async getConversation(
    organizationId: string,
    id: string,
  ): Promise<Conversation> {
    const result = await this.repository.findConversation(organizationId, id);
    if (result == null) throw new CommercialNotFoundError("Conversation");
    return result;
  }

  public async getOpportunity(
    organizationId: string,
    id: string,
  ): Promise<Opportunity> {
    const result = await this.repository.findOpportunity(organizationId, id);
    if (result == null) throw new CommercialNotFoundError("Opportunity");
    return result;
  }

  public async getLeadContext(
    organizationId: string,
    leadId: string,
  ): Promise<LeadContext> {
    const result = await this.repository.getLeadContext(organizationId, leadId);
    if (result == null) throw new CommercialNotFoundError("Lead");
    return result;
  }

  public async getLeadTimeline(
    organizationId: string,
    leadId: string,
    limit: number,
    cursor?: string,
  ): Promise<CommercialTimeline> {
    const result = await this.repository.getLeadTimeline(
      organizationId,
      leadId,
      limit,
      cursor,
    );
    if (result == null) throw new CommercialNotFoundError("Lead");
    return result;
  }

  private report(result: CommandResult): CommandResult {
    this.logger.info(
      {
        event: result.replayed
          ? "commercial_command_replayed"
          : "commercial_command_completed",
        commandId: result.receipt.commandId,
        commandType: result.receipt.commandType,
        targetType: result.receipt.targetType,
        targetId: result.receipt.targetId,
        resultCode: result.receipt.resultCode,
      },
      result.replayed
        ? "Commercial command replayed"
        : "Commercial command completed",
    );
    return result;
  }
}
