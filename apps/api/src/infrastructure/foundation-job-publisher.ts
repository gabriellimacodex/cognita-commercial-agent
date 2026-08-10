import type { Logger } from "@cognita/observability";
import {
  FOUNDATION_JOB_NAME,
  type FoundationJobQueueMessage,
} from "@cognita/schemas";

interface ExistingQueueJob {
  getState(): Promise<string>;
  remove(): Promise<void>;
}

export interface FoundationQueue {
  getJob(jobId: string): Promise<ExistingQueueJob | undefined>;
  add(
    name: typeof FOUNDATION_JOB_NAME,
    data: FoundationJobQueueMessage,
    options: {
      jobId: string;
      attempts: number;
      backoff: { type: "exponential"; delay: number };
      removeOnComplete: { age: number; count: number };
      removeOnFail: { age: number; count: number };
    },
  ): Promise<unknown>;
}

export interface PublishJobStore {
  reservePublishAttempt(id: string): Promise<boolean>;
  markQueued(id: string, recoverAfterMs: number): Promise<void>;
  recordPublishFailure(
    id: string,
    errorCode: string,
    safeMessage: string,
    retryAfterMs: number,
  ): Promise<void>;
}

export interface PublisherOptions {
  retryAfterMs: number;
  staleAfterMs: number;
}

export class BullMqFoundationJobPublisher {
  public constructor(
    private readonly queue: FoundationQueue,
    private readonly repository: PublishJobStore,
    private readonly logger: Pick<Logger, "warn">,
    private readonly options: PublisherOptions,
  ) {}

  public async publish(jobId: string, correlationId: string): Promise<void> {
    const reserved = await this.repository.reservePublishAttempt(jobId);
    if (!reserved) {
      return;
    }

    try {
      const existing = await this.queue.getJob(jobId);
      if (existing != null) {
        const state = await existing.getState();
        if (state === "completed" || state === "failed") {
          await existing.remove();
        } else {
          await this.repository.markQueued(jobId, this.options.staleAfterMs);
          return;
        }
      }

      await this.queue.add(
        FOUNDATION_JOB_NAME,
        { jobId, correlationId },
        {
          jobId,
          attempts: 3,
          backoff: { type: "exponential", delay: 500 },
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 86_400, count: 1_000 },
        },
      );
      await this.repository.markQueued(jobId, this.options.staleAfterMs);
    } catch (error) {
      await this.repository.recordPublishFailure(
        jobId,
        "QUEUE_UNAVAILABLE",
        "Queue publication is temporarily unavailable",
        this.options.retryAfterMs,
      );
      this.logger.warn(
        { event: "job_publish_failed", jobId, correlationId, err: error },
        "Foundation job publication failed",
      );
    }
  }
}
