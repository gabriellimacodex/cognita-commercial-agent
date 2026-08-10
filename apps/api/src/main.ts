import process from "node:process";

import { Redis } from "ioredis";

import {
  checkDatabase,
  createDatabase,
  FoundationJobRepository,
} from "@cognita/database";
import { createLogger } from "@cognita/observability";

import { FoundationJobService } from "./application/foundation-job-service.js";
import { readApiConfig } from "./config.js";
import { BullMqFoundationQueue } from "./infrastructure/bullmq-queue.js";
import { BullMqFoundationJobPublisher } from "./infrastructure/foundation-job-publisher.js";
import { buildApi } from "./server.js";

const config = readApiConfig();
const logger = createLogger({
  service: "api",
  environment: config.NODE_ENV,
  version: config.SERVICE_VERSION,
});
const database = createDatabase({ connectionString: config.DATABASE_URL });
const redis = new Redis(config.REDIS_URL, {
  connectTimeout: 2_000,
  commandTimeout: 2_000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});
const queue = new BullMqFoundationQueue({ connection: redis });
const repository = new FoundationJobRepository(database);
const publisher = new BullMqFoundationJobPublisher(queue, repository, logger, {
  retryAfterMs: config.JOB_PUBLISH_RETRY_MS,
  staleAfterMs: config.JOB_STALE_AFTER_MS,
});
const service = new FoundationJobService(repository, publisher);
const api = await buildApi({
  service,
  checkDatabase: async () => checkDatabase(database),
  checkRedis: async () => {
    await redis.ping();
  },
  logger,
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ event: "shutdown_started", signal });
  try {
    await api.close();
    await queue.close();
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

await api.listen({ host: config.API_HOST, port: config.API_PORT });
logger.info({ event: "service_started", port: config.API_PORT });
