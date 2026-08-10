import { Queue, type JobsOptions, type QueueOptions } from "bullmq";

import {
  FOUNDATION_QUEUE_NAME,
  type FoundationJobQueueMessage,
} from "@cognita/schemas";
import type { FOUNDATION_JOB_NAME } from "@cognita/schemas";

import type { FoundationQueue } from "./foundation-job-publisher.js";

export class BullMqFoundationQueue implements FoundationQueue {
  private readonly queue: Queue<
    FoundationJobQueueMessage,
    void,
    typeof FOUNDATION_JOB_NAME
  >;

  public constructor(connection: QueueOptions) {
    this.queue = new Queue<
      FoundationJobQueueMessage,
      void,
      typeof FOUNDATION_JOB_NAME
    >(FOUNDATION_QUEUE_NAME, {
      ...connection,
      prefix: "cognita",
    });
  }

  public async getJob(jobId: string) {
    return this.queue.getJob(jobId);
  }

  public async add(
    name: typeof FOUNDATION_JOB_NAME,
    data: FoundationJobQueueMessage,
    options: JobsOptions,
  ): Promise<unknown> {
    return this.queue.add(name, data, options);
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }
}
