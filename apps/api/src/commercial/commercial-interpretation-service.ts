import { createHash, randomUUID } from "node:crypto";

import type {
  CommercialInterpretationRepository,
  CommercialDecisionRepository,
} from "@cognita/database";
import type { Logger } from "@cognita/observability";
import type {
  ConfirmFactCandidateInput,
  FactCandidate,
  InterpretationRun,
  QuestionCandidate,
  RejectFactCandidateInput,
  StartInterpretationInput,
} from "@cognita/schemas";

import { hashCommercialCommand } from "./commercial-domain.js";
import {
  interpretationInvocationConfig,
  interpretationInstructionMetadata,
  interpretationOutputSchemaMetadata,
  type CommercialInterpretationProvider,
} from "./commercial-interpretation-provider.js";
import { alignEvidenceQuote } from "./evidence-alignment.js";
import {
  InvalidCommercialFactError,
  validateCommercialFact,
} from "./commercial-fact-catalog.js";

const questionTemplates = {
  lead_is_open: "O lead continua aberto?",
  opportunity_does_not_exist: "Já existe uma oportunidade para este lead?",
  contact_has_reachable_channel: "Qual canal permite contatar este lead?",
  facts_are_consistent: "Quais informações conflitantes devem ser corrigidas?",
  company_ownership_type_known: "Qual é o tipo de propriedade da empresa?",
  crm_usage_known: "A empresa utiliza CRM?",
  sales_capacity_known: "Quantos vendedores atuam na operação?",
  recurring_inbound_known: "A empresa recebe demanda inbound recorrente?",
  conversion_measurement_known: "A empresa mede conversão comercial?",
  sales_process_known: "A empresa possui processo comercial definido?",
  commercial_owner_known: "Existe responsável comercial definido?",
  lead_volume_known: "Qual é o volume mensal de leads?",
  average_ticket_known: "Qual é o ticket médio em reais?",
  roi_measurement_known: "É possível comprovar ROI em até 90 dias?",
  pain_confirmed_with_evidence: "A dor comercial foi confirmada com evidência?",
  pain_recurring_with_evidence:
    "A dor comercial é recorrente e possui evidência?",
  pain_measurable_with_evidence:
    "A dor comercial é mensurável e possui evidência?",
  decision_maker_access_known: "Existe acesso ao decisor?",
  budget_known: "O orçamento está confirmado?",
  operational_capacity_known:
    "Existe capacidade operacional para a iniciativa?",
  timing_known: "Qual é o timing atual da iniciativa?",
  nurture_revisit_date_known: "Quando o lead deve ser revisitado?",
  nurture_return_condition_known:
    "Qual condição objetiva permite retomar o lead?",
  human_authority_declared: "Qual autoridade humana decidirá este gate?",
  terminal_reason_from_catalog: "Qual motivo terminal do catálogo se aplica?",
  terminal_evidence_present: "Qual evidência sustenta a decisão terminal?",
  decision_input_is_current: "A decisão ainda representa os Facts atuais?",
  decision_has_not_been_applied: "A decisão ainda não foi aplicada?",
} as const;

function valueType(value: boolean | number | string, factKey: string) {
  if (typeof value === "boolean") return "boolean" as const;
  if (typeof value === "number") return "integer" as const;
  return factKey === "revisit_at"
    ? ("timestamp" as const)
    : ("string" as const);
}

export class CommercialInterpretationService {
  public constructor(
    private readonly repository: CommercialInterpretationRepository,
    private readonly decisionRepository: CommercialDecisionRepository,
    private readonly provider: CommercialInterpretationProvider,
    private readonly logger: Logger,
  ) {}

  public async start(
    messageId: string,
    input: StartInterpretationInput,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<InterpretationRun> {
    const semantic = {
      messageId,
      reprocessesRunId: input.reprocessesRunId ?? null,
    };
    const started = await this.repository.start({
      id: randomUUID(),
      organizationId: input.organizationId,
      messageId,
      idempotencyKey,
      requestHash: hashCommercialCommand(
        input.organizationId,
        "start_commercial_interpretation_v1",
        { messageId },
        semantic,
        input.executorRef,
      ),
      executorRef: input.executorRef,
      providerId: "openai",
      modelId: "gpt-5.6-terra",
      instructionKey: interpretationInstructionMetadata.key,
      instructionVersion: interpretationInstructionMetadata.version,
      instructionDigest: interpretationInstructionMetadata.digest,
      outputSchemaVersion: interpretationOutputSchemaMetadata.version,
      outputSchemaDigest: interpretationOutputSchemaMetadata.digest,
      invocationConfig: interpretationInvocationConfig,
      reprocessesRunId: input.reprocessesRunId ?? null,
    });
    if (started.replayed || started.run.status !== "running")
      return started.run;

    try {
      const providerResult = await this.provider.interpret(
        started.messageBody,
        correlationId,
      );
      const outputDigest = createHash("sha256")
        .update(JSON.stringify(providerResult.output))
        .digest("hex");
      const candidates = providerResult.output.candidates.map((candidate) => {
        const alignment = alignEvidenceQuote(
          started.messageBody,
          candidate.evidenceQuote,
        );
        let validationCode: string | null = alignment.valid
          ? null
          : alignment.validationCode;
        let candidateValueType:
          "boolean" | "integer" | "string" | "timestamp" | null = null;
        if (
          candidate.classification === "reviewable" &&
          candidate.proposedValue != null
        ) {
          try {
            candidateValueType = validateCommercialFact({
              organizationId: input.organizationId,
              factKey: candidate.factKey,
              factSchemaVersion: 1,
              value: candidate.proposedValue,
              sourceType: "human_declaration",
              sourceRef: "candidate-validation",
              declarerRef: "candidate-validation",
              executorRef: input.executorRef,
              observedAt: new Date().toISOString(),
              evidence: { type: "message", ref: messageId },
              correctsFactIds: [],
            });
          } catch (error) {
            if (!(error instanceof InvalidCommercialFactError)) throw error;
            validationCode = "invalid_fact_value";
          }
        }
        return {
          id: randomUUID(),
          factKey: candidate.factKey,
          factSchemaVersion: 1 as const,
          valueType: candidateValueType,
          proposedValue: candidate.proposedValue,
          classification:
            validationCode == null
              ? candidate.classification
              : ("invalid" as const),
          ambiguityCode: candidate.ambiguityCode,
          ambiguityDetails: candidate.ambiguityDetails,
          validationCode,
          evidence: alignment.valid
            ? {
                id: randomUUID(),
                startOffset: alignment.startOffset,
                endOffset: alignment.endOffset,
                spanDigest: alignment.spanDigest,
              }
            : null,
        };
      });
      const completed = await this.repository.complete(
        input.organizationId,
        started.run.id,
        input.executorRef,
        { ...providerResult, outputDigest, candidates },
      );
      this.logger.info(
        {
          event: "commercial_interpretation_completed",
          organizationId: input.organizationId,
          runId: completed.id,
          messageId,
          candidateCount: completed.candidates.length,
          durationMs: completed.durationMs,
        },
        "Commercial interpretation completed",
      );
      return completed;
    } catch (error) {
      const failureCode =
        error instanceof DOMException && error.name === "TimeoutError"
          ? "provider_timeout"
          : error instanceof SyntaxError ||
              (typeof error === "object" && error != null && "issues" in error)
            ? "invalid_structured_output"
            : "provider_error";
      const failed = await this.repository.fail(
        input.organizationId,
        started.run.id,
        input.executorRef,
        failureCode,
      );
      this.logger.warn(
        {
          event: "commercial_interpretation_failed",
          organizationId: input.organizationId,
          runId: failed.id,
          messageId,
          failureCode,
        },
        "Commercial interpretation failed",
      );
      return failed;
    }
  }

  public get(
    organizationId: string,
    runId: string,
  ): Promise<InterpretationRun> {
    return this.repository.get(organizationId, runId);
  }

  public list(
    organizationId: string,
    messageId: string,
  ): Promise<InterpretationRun[]> {
    return this.repository.listForMessage(organizationId, messageId);
  }

  public async confirm(
    candidateId: string,
    input: ConfirmFactCandidateInput,
    idempotencyKey: string,
  ): Promise<FactCandidate> {
    const candidate = await this.repository.findCandidate(
      input.organizationId,
      candidateId,
    );
    if (candidate.proposedValue == null) {
      throw new InvalidCommercialFactError(
        "Candidate has no exact proposed value",
      );
    }
    return this.repository.confirm({
      organizationId: input.organizationId,
      candidateId,
      commandId: randomUUID(),
      idempotencyKey,
      requestHash: hashCommercialCommand(
        input.organizationId,
        "confirm_commercial_fact_candidate_v1",
        { candidateId },
        input,
        input.executorRef,
      ),
      authorityRef: input.authorityRef,
      executorRef: input.executorRef,
      mode: input.mode,
      correctsFactIds: input.correctsFactIds,
      valueType: valueType(candidate.proposedValue, candidate.factKey),
    });
  }

  public reject(
    candidateId: string,
    input: RejectFactCandidateInput,
    idempotencyKey: string,
  ): Promise<FactCandidate> {
    return this.repository.reject({
      organizationId: input.organizationId,
      candidateId,
      commandId: randomUUID(),
      idempotencyKey,
      requestHash: hashCommercialCommand(
        input.organizationId,
        "reject_commercial_fact_candidate_v1",
        { candidateId },
        input,
        input.executorRef,
      ),
      authorityRef: input.authorityRef,
      executorRef: input.executorRef,
      reasonCode: input.reasonCode,
    });
  }

  public async questionCandidates(
    organizationId: string,
    leadId: string,
  ): Promise<QuestionCandidate[]> {
    const context = await this.decisionRepository.getDecisionContext(
      organizationId,
      leadId,
    );
    if (context.latestDecision == null) return [];
    return context.latestDecision.missingRequirements.map((requirementId) => ({
      requirementId,
      templateKey: `commercial-question-${requirementId}`,
      templateVersion: "1.0.0",
      text: questionTemplates[requirementId],
      decisionId: context.latestDecision!.id,
    }));
  }
}
