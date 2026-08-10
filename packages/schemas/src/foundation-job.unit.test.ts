import { describe, expect, it } from "vitest";

import {
  foundationJobSchema,
  foundationJobInputSchema,
  foundationJobStatusSchema,
} from "./foundation-job.js";

describe("foundationJobInputSchema", () => {
  it("rejects an empty technical input", () => {
    expect(foundationJobInputSchema.safeParse({ input: "" }).success).toBe(
      false,
    );
  });
});

describe("foundationJobSchema", () => {
  it("requires a persisted result for completed jobs", () => {
    const parsed = foundationJobSchema.safeParse({
      id: "5f360f2e-896c-42b3-81ad-3a691269c031",
      status: "completed",
      publishAttempts: 1,
      processAttempts: 1,
      createdAt: "2026-08-10T12:00:00.000Z",
      updatedAt: "2026-08-10T12:00:01.000Z",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("foundationJobStatusSchema", () => {
  it("rejects states outside the five accepted states", () => {
    expect(foundationJobStatusSchema.safeParse("retrying").success).toBe(false);
  });
});
