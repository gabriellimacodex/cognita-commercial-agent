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
  foundationJobSchema,
  type FoundationJobQueueMessage,
} from "@cognita/schemas";

import { FoundationJobService } from "../../apps/api/src/application/foundation-job-service.js";
import { BullMqFoundationQueue } from "../../apps/api/src/infrastructure/bullmq-queue.js";
import { BullMqFoundationJobPublisher } from "../../apps/api/src/infrastructure/foundation-job-publisher.js";
import { buildApi } from "../../apps/api/src/server.js";
import { FoundationJobProcessor } from "../../apps/worker/src/application/foundation-job-processor.js";
import { FoundationJobRecovery } from "../../apps/worker/src/application/foundation-job-recovery.js";
import { RecoveryJobPublisher } from "../../apps/worker/src/infrastructure/recovery-job-publisher.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

if (databaseUrl == null || redisUrl == null) {
  throw new Error(
    "DATABASE_URL and REDIS_URL are required for integration tests",
  );
}

const requiredRedisUrl = redisUrl;

const database = createDatabase({ connectionString: databaseUrl });
const repository = new FoundationJobRepository(database);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
const cleanupQueue = new Queue(FOUNDATION_QUEUE_NAME, {
  connection: redis,
  prefix: "cognita",
});
const logger = createLogger({
  service: "test",
  environment: "test",
  version: "test",
});

async function waitForCompletedJob(id: string) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const row = await repository.findById(id);
    if (row?.status === "completed") return row;
    await delay(25);
  }
  throw new Error("Recovered foundation job did not complete before timeout");
}

async function startWorker() {
  const connection = new Redis(requiredRedisUrl, {
    maxRetriesPerRequest: null,
  });
  const processor = new FoundationJobProcessor(repository, {
    leaseMs: 1_000,
    retryAfterMs: 50,
  });
  const worker = new Worker<FoundationJobQueueMessage>(
    FOUNDATION_QUEUE_NAME,
    async (job) => {
      await processor.process(job.data, {
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? 1,
      });
    },
    { connection, concurrency: 1, prefix: "cognita" },
  );
  await worker.waitUntilReady();
  return { worker, connection };
}

describe("foundation failure recovery", () => {
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
  });

  beforeEach(async () => {
    await cleanupQueue.obliterate({ force: true });
    await database.deleteFrom("foundationJobs").execute();
  });

  afterAll(async () => {
    await cleanupQueue.close();
    await redis.quit();
    await database.destroy();
  });

  it("keeps the job durable while Redis is unavailable and completes it after recovery", async () => {
    const unavailableRedis = new Redis("redis://127.0.0.1:6399", {
      connectTimeout: 100,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    unavailableRedis.on("error", () => undefined);
    const unavailableQueue = new BullMqFoundationQueue({
      connection: unavailableRedis,
    });
    const unavailablePublisher = new BullMqFoundationJobPublisher(
      unavailableQueue,
      repository,
      logger,
      { retryAfterMs: 1, staleAfterMs: 100 },
    );
    const api = await buildApi({
      service: new FoundationJobService(repository, unavailablePublisher),
      checkDatabase: async () => undefined,
      checkRedis: async () => {
        throw new Error("Redis unavailable");
      },
      logger,
    });

    const response = await api.inject({
      method: "POST",
      url: "/foundation/jobs",
      headers: { "idempotency-key": "redis-recovery-1" },
      payload: { input: "durable before queue" },
    });
    const pending = foundationJobSchema.parse(response.json());
    const persisted = await repository.findById(pending.id);

    expect(response.statusCode).toBe(202);
    expect(pending.status).toBe("pending");
    expect(persisted?.lastErrorCode).toBe("QUEUE_UNAVAILABLE");

    await api.close();
    await unavailableQueue.close();
    unavailableRedis.disconnect();

    const runningWorker = await startWorker();
    const recoveryPublisher = new RecoveryJobPublisher(
      { connection: redis },
      repository,
      logger,
      100,
    );
    const recovery = new FoundationJobRecovery(repository, recoveryPublisher, {
      batchSize: 10,
      claimMs: 100,
    });
    await recovery.runOnce();
    const completed = await waitForCompletedJob(pending.id);

    expect(completed.status).toBe("completed");
    expect(completed.resultDigest).toMatch(/^[a-f0-9]{64}$/);

    await runningWorker.worker.close();
    await runningWorker.connection.quit();
    await recoveryPublisher.close();
  });

  it("keeps a queued job while the worker is unavailable and recovers after Redis data is lost", async () => {
    const queue = new BullMqFoundationQueue({ connection: redis });
    const publisher = new BullMqFoundationJobPublisher(
      queue,
      repository,
      logger,
      { retryAfterMs: 50, staleAfterMs: 100 },
    );
    const api = await buildApi({
      service: new FoundationJobService(repository, publisher),
      checkDatabase: async () => undefined,
      checkRedis: async () => undefined,
      logger,
    });

    const response = await api.inject({
      method: "POST",
      url: "/foundation/jobs",
      headers: { "idempotency-key": "worker-unavailable-1" },
      payload: { input: "queued without worker" },
    });
    const queued = foundationJobSchema.parse(response.json());

    expect(queued.status).toBe("queued");
    expect((await repository.findById(queued.id))?.status).toBe("queued");

    await redis.flushall();
    await database
      .updateTable("foundationJobs")
      .set({ nextPublishAt: new Date(0) })
      .where("id", "=", queued.id)
      .execute();

    const runningWorker = await startWorker();
    const recoveryPublisher = new RecoveryJobPublisher(
      { connection: redis },
      repository,
      logger,
      100,
    );
    const recovery = new FoundationJobRecovery(repository, recoveryPublisher, {
      batchSize: 10,
      claimMs: 100,
    });
    await recovery.runOnce();
    const completed = await waitForCompletedJob(queued.id);

    expect(completed.status).toBe("completed");

    await runningWorker.worker.close();
    await runningWorker.connection.quit();
    await recoveryPublisher.close();
    await api.close();
    await queue.close();
  });
});
