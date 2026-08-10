import { describe, expect, it, vi } from "vitest";

import { createLogger } from "@cognita/observability";
import { apiErrorSchema } from "@cognita/schemas";

import { buildApi } from "./server.js";

describe("foundation job routes", () => {
  it("requires Idempotency-Key before invoking the application service", async () => {
    const service = {
      create: vi.fn(),
      getById: vi.fn(),
    };
    const api = await buildApi({
      service,
      checkDatabase: async () => undefined,
      checkRedis: async () => undefined,
      logger: createLogger({
        service: "test",
        environment: "test",
        version: "test",
      }),
    });

    const response = await api.inject({
      method: "POST",
      url: "/foundation/jobs",
      payload: { input: "foundation" },
    });

    expect(response.statusCode).toBe(400);
    const body = apiErrorSchema.parse(response.json());
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(service.create).not.toHaveBeenCalled();
    await api.close();
  });
});
