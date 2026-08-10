import process from "node:process";

import { Worker } from "bullmq";
import { Redis } from "ioredis";

import {
  checkDatabase,
  createDatabase,
  FoundationJobRepository,
} from "@cognita/database";
import { createLogger } from "@cognita/observability";
import {
  FOUNDATION_QUEUE_NAME,
  foundationJobQueueMessageSchema,
  type FoundationJobQueueMessage,
} from "@cognita/schemas";

import { FoundationJobProcessor } from "./application/foundation-job-processor.js";
import { FoundationJobRecovery } from "./application/foundation-job-recovery.js";
import { readWorkerConfig } from "./config.js";
import { buildWorkerHealthServer } from "./health-server.js";
import { RecoveryJobPublisher } from "./infrastructure/recovery-job-publisher.js";

const config = readWorkerConfig();
const logger = createLogger({
  service: "worker",
  environment: config.NODE_ENV,
  version: config.SERVICE_VERSION,
});
const database = createDatabase({ connectionString: config.DATABASE_URL });
const repository = new FoundationJobRepository(database);
const redis = new Redis(config.REDIS_URL, {
  connectTimeout: 2_000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: null,
});
const processor = new FoundationJobProcessor(
  repository,
  {
    leaseMs: config.JOB_PROCESSING_LEASE_MS,
    retryAfterMs: config.JOB_PROCESS_RETRY_MS,
  },
  logger,
);
const worker = new Worker<FoundationJobQueueMessage>(
  FOUNDATION_QUEUE_NAME,
  async (job) => {
    const message = foundationJobQueueMessageSchema.parse(job.data);
    await processor.process(message, {
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 1,
    });
  },
  { connection: redis, concurrency: 1, prefix: "cognita" },
);
worker.on("error", (error) => {
  logger.error({ event: "worker_error", err: error });
});
worker.on("failed", (job, error) => {
  logger.error({
    event: "queue_job_failed",
    jobId: job?.id,
    errorCode: "QUEUE_JOB_FAILED",
    err: error,
  });
});

const recoveryPublisher = new RecoveryJobPublisher(
  { connection: redis },
  repository,
  logger,
  config.JOB_STALE_AFTER_MS,
);
const recovery = new FoundationJobRecovery(
  repository,
  recoveryPublisher,
  {
    batchSize: config.JOB_RECOVERY_BATCH_SIZE,
    claimMs: config.JOB_RECOVERY_CLAIM_MS,
  },
  logger,
);
const healthServer = await buildWorkerHealthServer({
  checkDatabase: async () => checkDatabase(database),
  checkRedis: async () => {
    await redis.ping();
  },
  isWorkerReady: () => worker.isRunning(),
});

await worker.waitUntilReady();
recovery.start(config.JOB_RECOVERY_INTERVAL_MS);
await healthServer.listen({
  host: config.WORKER_HEALTH_HOST,
  port: config.WORKER_HEALTH_PORT,
});
logger.info({ event: "service_started", port: config.WORKER_HEALTH_PORT });

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ event: "shutdown_started", signal });
  try {
    await recovery.stop();
    await worker.close();
    await recoveryPublisher.close();
    await healthServer.close();
    await redis.quit();
    await database.destroy();
    logger.info({ event: "shutdown_completed", signal });
  } catch (error) {
    logger.error({ event: "shutdown_failed", signal, err: error });
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
