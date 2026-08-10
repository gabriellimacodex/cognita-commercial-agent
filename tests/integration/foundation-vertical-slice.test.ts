import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Migrator } from "kysely/migration";

import {
  createDatabase,
  FoundationJobRepository,
  migrationProvider,
} from "@cognita/database";
import { createLogger } from "@cognita/observability";
import {
  FOUNDATION_QUEUE_NAME,
  apiErrorSchema,
  foundationJobSchema,
  type FoundationJobQueueMessage,
} from "@cognita/schemas";

import { FoundationJobService } from "../../apps/api/src/application/foundation-job-service.js";
import { BullMqFoundationQueue } from "../../apps/api/src/infrastructure/bullmq-queue.js";
import { BullMqFoundationJobPublisher } from "../../apps/api/src/infrastructure/foundation-job-publisher.js";
import { buildApi } from "../../apps/api/src/server.js";
import { FoundationJobProcessor } from "../../apps/worker/src/application/foundation-job-processor.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

if (databaseUrl == null || redisUrl == null) {
  throw new Error(
    "DATABASE_URL and REDIS_URL are required for integration tests",
  );
}

const database = createDatabase({ connectionString: databaseUrl });
const repository = new FoundationJobRepository(database);
const apiRedis = new Redis(redisUrl, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});
const workerRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const queue = new BullMqFoundationQueue({ connection: apiRedis });
const logger = createLogger({
  service: "test",
  environment: "test",
  version: "test",
});
const publisher = new BullMqFoundationJobPublisher(queue, repository, logger, {
  retryAfterMs: 50,
  staleAfterMs: 100,
});
const service = new FoundationJobService(repository, publisher);
const processor = new FoundationJobProcessor(repository, {
  leaseMs: 1_000,
  retryAfterMs: 50,
});
const api = await buildApi({
  service,
  checkDatabase: async () => undefined,
  checkRedis: async () => undefined,
  logger,
});
const worker = new Worker<FoundationJobQueueMessage>(
  FOUNDATION_QUEUE_NAME,
  async (job) => {
    await processor.process(job.data, {
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 1,
    });
  },
  { connection: workerRedis, concurrency: 1, prefix: "cognita" },
);
const cleanupQueue = new Queue(FOUNDATION_QUEUE_NAME, {
  connection: apiRedis,
  prefix: "cognita",
});

async function waitForCompletedJob(id: string) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await api.inject({
      method: "GET",
      url: `/foundation/jobs/${id}`,
    });
    const job = foundationJobSchema.parse(response.json());
    if (job.status === "completed") return job;
    await delay(25);
  }
  throw new Error("Foundation job did not complete before the timeout");
}

describe("foundation vertical slice", () => {
  beforeAll(async () => {
    const migrator = new Migrator({
      db: database,
      provider: migrationProvider,
    });
    const result = await migrator.migrateToLatest();
    if (result.error != null) {
      throw result.error instanceof Error
        ? result.error
        : new Error("Foundation migration failed");
    }
    await worker.waitUntilReady();
  });

  beforeEach(async () => {
    await cleanupQueue.obliterate({ force: true });
    await database.deleteFrom("foundationJobs").execute();
  });

  afterAll(async () => {
    await worker.close();
    await cleanupQueue.close();
    await queue.close();
    await api.close();
    await apiRedis.quit();
    await workerRedis.quit();
    await database.destroy();
  });

  it("persists, queues, processes and returns a durable SHA-256 result", async () => {
    const input = "foundation vertical slice";
    const createResponse = await api.inject({
      method: "POST",
      url: "/foundation/jobs",
      headers: { "idempotency-key": "vertical-slice-1" },
      payload: { input },
    });
    const created = foundationJobSchema.parse(createResponse.json());

    const completed = await waitForCompletedJob(created.id);
    const reloadedResponse = await api.inject({
      method: "GET",
      url: `/foundation/jobs/${created.id}`,
    });
    const reloaded = foundationJobSchema.parse(reloadedResponse.json());

    expect(createResponse.statusCode).toBe(202);
    expect(completed.status).toBe("completed");
    expect(completed.result).toEqual({
      algorithm: "sha256",
      digest: createHash("sha256").update(input).digest("hex"),
      inputBytes: Buffer.byteLength(input),
    });
    expect(reloaded).toEqual(completed);
  });

  it("returns the same persisted resource for an idempotent replay", async () => {
    const request = {
      method: "POST" as const,
      url: "/foundation/jobs",
      headers: { "idempotency-key": "replay-1" },
      payload: { input: "same payload" },
    };

    const firstResponse = await api.inject(request);
    const secondResponse = await api.inject(request);
    const first = foundationJobSchema.parse(firstResponse.json());
    const second = foundationJobSchema.parse(secondResponse.json());
    const persistedCount = await database
      .selectFrom("foundationJobs")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    expect(firstResponse.statusCode).toBe(202);
    expect(secondResponse.statusCode).toBe(202);
    expect(second.id).toBe(first.id);
    expect(Number(persistedCount.count)).toBe(1);
  });

  it("returns 409 when an idempotency key is reused with another payload", async () => {
    await api.inject({
      method: "POST",
      url: "/foundation/jobs",
      headers: { "idempotency-key": "conflict-1" },
      payload: { input: "first payload" },
    });

    const conflictResponse = await api.inject({
      method: "POST",
      url: "/foundation/jobs",
      headers: { "idempotency-key": "conflict-1" },
      payload: { input: "different payload" },
    });
    const conflict = apiErrorSchema.parse(conflictResponse.json());

    expect(conflictResponse.statusCode).toBe(409);
    expect(conflict.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });
});
