import { z } from "zod";

const apiConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    SERVICE_VERSION: z.string().min(1),
    API_HOST: z.string().min(1).default("0.0.0.0"),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    JOB_PUBLISH_RETRY_MS: z.coerce.number().int().positive().default(1_000),
    JOB_STALE_AFTER_MS: z.coerce.number().int().positive().default(5_000),
    COMMERCIAL_INTERPRETATION_PROVIDER: z
      .enum(["fake", "openai"])
      .default("fake"),
    OPENAI_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((config, context) => {
    if (
      config.COMMERCIAL_INTERPRETATION_PROVIDER === "openai" &&
      config.OPENAI_API_KEY == null
    ) {
      context.addIssue({
        code: "custom",
        message:
          "OPENAI_API_KEY is required for the OpenAI interpretation provider",
      });
    }
  });

export function readApiConfig(environment: NodeJS.ProcessEnv = process.env) {
  return apiConfigSchema.parse(environment);
}

export type ApiConfig = ReturnType<typeof readApiConfig>;
