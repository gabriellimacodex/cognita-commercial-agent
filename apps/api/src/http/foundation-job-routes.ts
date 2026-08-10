import type { FastifyInstance } from "fastify";

import type { FoundationJobHandler } from "./foundation-job-handler.js";

export function registerFoundationJobRoutes(
  api: FastifyInstance,
  handler: FoundationJobHandler,
): void {
  api.post("/foundation/jobs", handler.create);
  api.get("/foundation/jobs/:id", handler.getById);
}
