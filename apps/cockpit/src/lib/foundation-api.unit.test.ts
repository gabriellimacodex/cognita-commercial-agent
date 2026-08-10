import { afterEach, describe, expect, it, vi } from "vitest";

import { getServiceHealth } from "./foundation-api";

describe("getServiceHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a healthy external readiness response to the configured service", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(
      getServiceHealth("http://n8n:5678/healthz/readiness", "n8n"),
    ).resolves.toEqual({ status: "ok", service: "n8n" });
  });
});
