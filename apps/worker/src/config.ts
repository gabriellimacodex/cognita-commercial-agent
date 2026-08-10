import { z } from "zod";

const workerConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  SERVICE_VERSION: z.string().min(1),
  WORKER_HEALTH_HOST: z.string().min(1).default("0.0.0.0"),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  JOB_PROCESSING_LEASE_MS: z.coerce.number().int().positive().default(5_000),
  JOB_PROCESS_RETRY_MS: z.coerce.number().int().positive().default(1_000),
  JOB_RECOVERY_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  JOB_RECOVERY_CLAIM_MS: z.coerce.number().int().positive().default(5_000),
  JOB_RECOVERY_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  JOB_STALE_AFTER_MS: z.coerce.number().int().positive().default(5_000),
});

export function readWorkerConfig(environment: NodeJS.ProcessEnv = process.env) {
  return workerConfigSchema.parse(environment);
}

export type WorkerConfig = ReturnType<typeof readWorkerConfig>;
