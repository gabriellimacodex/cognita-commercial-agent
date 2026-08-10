import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  foundationJobInputSchema,
  foundationJobSchema,
  type FoundationJob,
  type FoundationJobInput,
} from "@cognita/schemas";

export interface FoundationJobApplicationService {
  create(
    input: FoundationJobInput,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<FoundationJob>;
  getById(id: string): Promise<FoundationJob>;
}

const idempotencyKeySchema = z.string().min(1).max(255);
const correlationIdSchema = z.string().min(1).max(128);
const jobParamsSchema = z.object({ id: z.uuid() });

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
): void {
  void reply.status(statusCode).send({
    error: { code, message, requestId: request.id },
  });
}

export class FoundationJobHandler {
  public constructor(
    private readonly service: FoundationJobApplicationService,
  ) {}

  public create = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const idempotencyKey = idempotencyKeySchema.safeParse(
      request.headers["idempotency-key"],
    );
    if (!idempotencyKey.success) {
      sendError(
        request,
        reply,
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key header is required",
      );
      return;
    }

    const input = foundationJobInputSchema.safeParse(request.body);
    if (!input.success) {
      sendError(
        request,
        reply,
        400,
        "INVALID_FOUNDATION_JOB_INPUT",
        "Request body is invalid",
      );
      return;
    }

    const correlationHeader = correlationIdSchema.safeParse(
      request.headers["x-correlation-id"],
    );
    const correlationId = correlationHeader.success
      ? correlationHeader.data
      : request.id;
    const job = await this.service.create(
      input.data,
      idempotencyKey.data,
      correlationId,
    );
    await reply.status(202).send(foundationJobSchema.parse(job));
  };

  public getById = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const parameters = jobParamsSchema.safeParse(request.params);
    if (!parameters.success) {
      sendError(
        request,
        reply,
        400,
        "INVALID_FOUNDATION_JOB_ID",
        "Foundation job id must be a UUID",
      );
      return;
    }

    const job = await this.service.getById(parameters.data.id);
    await reply.send(foundationJobSchema.parse(job));
  };
}
