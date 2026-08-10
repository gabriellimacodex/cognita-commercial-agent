import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import type { Logger } from "@cognita/observability";

import {
  FoundationJobNotFoundError,
  IdempotencyConflictError,
} from "./application/foundation-job-service.js";
import {
  FoundationJobHandler,
  type FoundationJobApplicationService,
} from "./http/foundation-job-handler.js";
import { registerFoundationJobRoutes } from "./http/foundation-job-routes.js";
import { HealthHandler } from "./http/health-handler.js";

export interface ApiDependencies {
  service: FoundationJobApplicationService;
  checkDatabase(): Promise<void>;
  checkRedis(): Promise<void>;
  logger: Logger;
}

export async function buildApi(
  dependencies: ApiDependencies,
): Promise<FastifyInstance> {
  const api = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    bodyLimit: 16 * 1024,
  });

  await api.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
  });

  const foundationJobHandler = new FoundationJobHandler(dependencies.service);
  const healthHandler = new HealthHandler(dependencies);
  registerFoundationJobRoutes(api, foundationJobHandler);
  api.get("/health", healthHandler.get);

  api.setErrorHandler(async (error, request, reply) => {
    if (error instanceof IdempotencyConflictError) {
      await reply.status(409).send({
        error: {
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }
    if (error instanceof FoundationJobNotFoundError) {
      await reply.status(404).send({
        error: {
          code: "FOUNDATION_JOB_NOT_FOUND",
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }

    dependencies.logger.error(
      { event: "request_failed", requestId: request.id, err: error },
      "Request failed",
    );
    await reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: request.id,
      },
    });
  });

  return api;
}
