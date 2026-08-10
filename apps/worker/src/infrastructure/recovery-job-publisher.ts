import { Queue, type QueueOptions } from "bullmq";

import type { FoundationJobRepository } from "@cognita/database";
import type { Logger } from "@cognita/observability";
import {
  FOUNDATION_JOB_NAME,
  FOUNDATION_QUEUE_NAME,
  type FoundationJobQueueMessage,
} from "@cognita/schemas";

export class RecoveryJobPublisher {
  private readonly queue: Queue<
    FoundationJobQueueMessage,
    void,
    typeof FOUNDATION_JOB_NAME
  >;

  public constructor(
    connection: QueueOptions,
    private readonly repository: FoundationJobRepository,
    private readonly logger: Pick<Logger, "warn">,
    private readonly staleAfterMs: number,
  ) {
    this.queue = new Queue<
      FoundationJobQueueMessage,
      void,
      typeof FOUNDATION_JOB_NAME
    >(FOUNDATION_QUEUE_NAME, {
      ...connection,
      prefix: "cognita",
    });
  }

  public async publish(jobId: string, correlationId: string): Promise<void> {
    const reserved = await this.repository.reservePublishAttempt(jobId);
    if (!reserved) return;

    try {
      const existing = await this.queue.getJob(jobId);
      if (existing != null) {
        const state = await existing.getState();
        if (state === "completed" || state === "failed") {
          await existing.remove();
        } else {
          await this.repository.markQueued(jobId, this.staleAfterMs);
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
      await this.repository.markQueued(jobId, this.staleAfterMs);
    } catch (error) {
      await this.repository.recordPublishFailure(
        jobId,
        "QUEUE_UNAVAILABLE",
        "Queue publication is temporarily unavailable",
        this.staleAfterMs,
      );
      this.logger.warn(
        {
          event: "job_recovery_publish_failed",
          jobId,
          correlationId,
          err: error,
        },
        "Foundation job recovery publication failed",
      );
    }
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }
}
