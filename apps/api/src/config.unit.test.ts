import { describe, expect, it } from "vitest";

import { readApiConfig } from "./config.js";

const baseEnvironment = {
  NODE_ENV: "test",
  SERVICE_VERSION: "test",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  REDIS_URL: "redis://127.0.0.1:6379",
};

describe("API configuration", () => {
  it("keeps the operational rate limit at 100 by default", () => {
    expect(readApiConfig(baseEnvironment).API_RATE_LIMIT_MAX).toBe(100);
  });

  it("accepts an explicit positive rate limit for isolated E2E execution", () => {
    expect(
      readApiConfig({
        ...baseEnvironment,
        API_RATE_LIMIT_MAX: "500",
      }).API_RATE_LIMIT_MAX,
    ).toBe(500);
  });
});
