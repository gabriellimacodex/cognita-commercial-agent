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
import { decisionQuestionCandidate } from "./commercial-question-candidates.js";

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
    return context.latestDecision.missingRequirements.map((requirementId) =>
      decisionQuestionCandidate(requirementId, context.latestDecision!.id),
    );
  }
}
