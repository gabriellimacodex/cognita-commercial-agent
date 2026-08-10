import { createHash } from "node:crypto";

import type { FoundationJobRow, JobResultRecord } from "@cognita/database";
import type { Logger } from "@cognita/observability";
import {
  foundationJobQueueMessageSchema,
  type FoundationJobQueueMessage,
} from "@cognita/schemas";

export interface ProcessorJobStore {
  acquireForProcessing(
    id: string,
    leaseMs: number,
  ): Promise<FoundationJobRow | undefined>;
  complete(
    id: string,
    expectedAttempt: number,
    result: JobResultRecord,
  ): Promise<boolean>;
  scheduleProcessRetry(
    id: string,
    expectedAttempt: number,
    errorCode: string,
    safeMessage: string,
    retryAfterMs: number,
  ): Promise<boolean>;
  fail(
    id: string,
    expectedAttempt: number,
    errorCode: string,
    safeMessage: string,
  ): Promise<boolean>;
}

export interface ProcessorOptions {
  leaseMs: number;
  retryAfterMs: number;
}

export interface ProcessingAttempt {
  attempt: number;
  maxAttempts: number;
}

export class FoundationJobProcessor {
  public constructor(
    private readonly repository: ProcessorJobStore,
    private readonly options: ProcessorOptions,
    private readonly logger?: Pick<Logger, "info" | "warn" | "error">,
  ) {}

  public async process(
    message: FoundationJobQueueMessage,
    processingAttempt: ProcessingAttempt,
  ): Promise<void> {
    const parsedMessage = foundationJobQueueMessageSchema.parse(message);
    let acquired: FoundationJobRow | undefined;

    try {
      acquired = await this.repository.acquireForProcessing(
        parsedMessage.jobId,
        this.options.leaseMs,
      );
      if (acquired == null) {
        this.logger?.info({
          event: "job_processing_skipped",
          jobId: parsedMessage.jobId,
          correlationId: parsedMessage.correlationId,
        });
        return;
      }

      this.logger?.info({
        event: "job_processing_started",
        jobId: acquired.id,
        correlationId: parsedMessage.correlationId,
        processAttempt: acquired.processAttempts,
      });
      const result = this.calculateResult(acquired);
      const completed = await this.repository.complete(
        acquired.id,
        acquired.processAttempts,
        result,
      );
      if (!completed) {
        this.logger?.warn({
          event: "job_completion_rejected",
          jobId: acquired.id,
          correlationId: parsedMessage.correlationId,
          processAttempt: acquired.processAttempts,
        });
        return;
      }
      this.logger?.info({
        event: "job_processing_completed",
        jobId: acquired.id,
        correlationId: parsedMessage.correlationId,
        processAttempt: acquired.processAttempts,
      });
    } catch (error) {
      if (acquired != null) {
        const finalAttempt =
          processingAttempt.attempt >= processingAttempt.maxAttempts;
        if (finalAttempt) {
          await this.repository.fail(
            acquired.id,
            acquired.processAttempts,
            "PROCESSING_FAILED",
            "Foundation job processing failed",
          );
        } else {
          await this.repository.scheduleProcessRetry(
            acquired.id,
            acquired.processAttempts,
            "PROCESSING_RETRY",
            "Foundation job processing will be retried",
            this.options.retryAfterMs,
          );
        }
        this.logger?.error({
          event: "job_processing_failed",
          jobId: acquired.id,
          correlationId: parsedMessage.correlationId,
          processAttempt: acquired.processAttempts,
          finalAttempt,
          err: error,
        });
      }
      throw error;
    }
  }

  private calculateResult(job: FoundationJobRow): JobResultRecord {
    const input = job.input.input;
    return {
      algorithm: "sha256",
      digest: createHash("sha256").update(input).digest("hex"),
      inputBytes: Buffer.byteLength(input),
    };
  }
}
