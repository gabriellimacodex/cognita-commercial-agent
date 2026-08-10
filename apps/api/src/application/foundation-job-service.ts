import { createHash, randomUUID } from "node:crypto";

import {
  serializeFoundationJob,
  type CreateFoundationJobRecord,
  type CreatedOrExistingJob,
  type FoundationJobRow,
} from "@cognita/database";
import type { FoundationJob, FoundationJobInput } from "@cognita/schemas";

export class IdempotencyConflictError extends Error {
  public constructor() {
    super("Idempotency-Key was already used with a different payload");
    this.name = "IdempotencyConflictError";
  }
}

export class FoundationJobNotFoundError extends Error {
  public constructor() {
    super("Foundation job was not found");
    this.name = "FoundationJobNotFoundError";
  }
}

export interface FoundationJobStore {
  createOrGet(record: CreateFoundationJobRecord): Promise<CreatedOrExistingJob>;
  findById(id: string): Promise<FoundationJobRow | undefined>;
}

export interface FoundationJobPublisher {
  publish(jobId: string, correlationId: string): Promise<void>;
}

export type IdFactory = () => string;

export function hashFoundationJobInput(input: FoundationJobInput): string {
  return createHash("sha256")
    .update(JSON.stringify({ input: input.input }))
    .digest("hex");
}

export class FoundationJobService {
  public constructor(
    private readonly repository: FoundationJobStore,
    private readonly publisher: FoundationJobPublisher,
    private readonly createId: IdFactory = randomUUID,
  ) {}

  public async create(
    input: FoundationJobInput,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<FoundationJob> {
    const requestHash = hashFoundationJobInput(input);
    const persisted = await this.repository.createOrGet({
      id: this.createId(),
      idempotencyKey,
      requestHash,
      input,
    });

    if (!persisted.created && persisted.job.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }

    if (persisted.created) {
      await this.publisher.publish(persisted.job.id, correlationId);
    }

    const current = await this.repository.findById(persisted.job.id);
    if (current == null) {
      throw new FoundationJobNotFoundError();
    }
    return serializeFoundationJob(current);
  }

  public async getById(id: string): Promise<FoundationJob> {
    const job = await this.repository.findById(id);
    if (job == null) {
      throw new FoundationJobNotFoundError();
    }
    return serializeFoundationJob(job);
  }
}
