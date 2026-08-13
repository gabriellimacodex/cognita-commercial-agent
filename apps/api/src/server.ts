import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import type { Logger } from "@cognita/observability";
import {
  CommercialConflictError,
  CommercialIdempotencyConflictError,
  CommercialInvariantError,
  CommercialNotFoundError,
} from "@cognita/database";

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
import {
  InvalidCnpjError,
  InvalidCommercialTransitionError,
} from "./commercial/commercial-domain.js";
import { CommercialHandler } from "./commercial/commercial-handler.js";
import { InvalidCommercialFactError } from "./commercial/commercial-fact-catalog.js";
import {
  registerCommercialInterpretationRoutes,
  registerCommercialRoutes,
} from "./commercial/commercial-routes.js";
import type { CommercialService } from "./commercial/commercial-service.js";
import type { CommercialInterpretationService } from "./commercial/commercial-interpretation-service.js";

export interface ApiDependencies {
  service: FoundationJobApplicationService;
  commercialService?: CommercialService;
  commercialInterpretationService?: CommercialInterpretationService;
  rateLimitMax?: number;
  checkDatabase(): Promise<void>;
  checkRedis(): Promise<void>;
  logger: Logger;
}

function databaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
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
    max: dependencies.rateLimitMax ?? 100,
    timeWindow: "1 minute",
  });

  const foundationJobHandler = new FoundationJobHandler(dependencies.service);
  const healthHandler = new HealthHandler(dependencies);
  registerFoundationJobRoutes(api, foundationJobHandler);
  if (dependencies.commercialService != null) {
    const commercialHandler = new CommercialHandler(
      dependencies.commercialService,
      dependencies.commercialInterpretationService,
    );
    registerCommercialRoutes(api, commercialHandler);
    if (dependencies.commercialInterpretationService != null) {
      registerCommercialInterpretationRoutes(api, commercialHandler);
    }
  }
  api.get("/health", healthHandler.get);

  api.setErrorHandler(async (error, request, reply) => {
    if (error instanceof CommercialIdempotencyConflictError) {
      dependencies.logger.warn(
        { event: "commercial_command_conflicted", requestId: request.id },
        "Commercial command idempotency conflict",
      );
      await reply.status(409).send({
        error: {
          code: "COMMERCIAL_IDEMPOTENCY_CONFLICT",
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }
    if (error instanceof CommercialConflictError) {
      if (error.code === "DECISION_STALE") {
        dependencies.logger.warn(
          { event: "commercial_decision_stale", requestId: request.id },
          "Commercial Decision is stale",
        );
      }
      await reply.status(409).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }
    if (error instanceof CommercialNotFoundError) {
      await reply.status(404).send({
        error: {
          code: "COMMERCIAL_RESOURCE_NOT_FOUND",
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }
    if (
      error instanceof CommercialInvariantError ||
      error instanceof InvalidCommercialTransitionError
    ) {
      await reply.status(422).send({
        error: {
          code:
            error instanceof CommercialInvariantError
              ? error.code
              : "INVALID_COMMERCIAL_TRANSITION",
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }
    if (error instanceof InvalidCnpjError) {
      await reply.status(400).send({
        error: {
          code: "INVALID_CNPJ",
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }
    if (error instanceof InvalidCommercialFactError) {
      await reply.status(400).send({
        error: {
          code: "INVALID_COMMERCIAL_FACT",
          message: error.message,
          requestId: request.id,
        },
      });
      return;
    }
    if (
      request.url.startsWith("/commercial/") &&
      databaseErrorCode(error) === "23505"
    ) {
      await reply.status(409).send({
        error: {
          code: "COMMERCIAL_UNIQUENESS_CONFLICT",
          message: "A commercial identity or cardinality constraint conflicted",
          requestId: request.id,
        },
      });
      return;
    }
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

    const commercial = request.url.startsWith("/commercial/");
    if (commercial) {
      dependencies.logger.error(
        {
          event: "commercial_request_failed",
          requestId: request.id,
          errorName: error instanceof Error ? error.name : "UnknownError",
          databaseCode: databaseErrorCode(error),
        },
        "Commercial request failed",
      );
    } else {
      dependencies.logger.error(
        { event: "request_failed", requestId: request.id, err: error },
        "Request failed",
      );
    }
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
