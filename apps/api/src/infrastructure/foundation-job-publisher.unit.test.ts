import { describe, expect, it, vi } from "vitest";

import { BullMqFoundationJobPublisher } from "./foundation-job-publisher.js";

describe("BullMqFoundationJobPublisher", () => {
  it("keeps a persisted job pending when Redis publication fails", async () => {
    const repository = {
      reservePublishAttempt: vi.fn(async () => true),
      markQueued: vi.fn(async () => undefined),
      recordPublishFailure: vi.fn(async () => undefined),
    };
    const queue = {
      getJob: vi.fn(async () => undefined),
      add: vi.fn(async () => {
        throw new Error("redis unavailable");
      }),
    };
    const logger = { warn: vi.fn() };
    const publisher = new BullMqFoundationJobPublisher(
      queue,
      repository,
      logger,
      { retryAfterMs: 100, staleAfterMs: 1_000 },
    );

    await publisher.publish(
      "5f360f2e-896c-42b3-81ad-3a691269c031",
      "correlation-1",
    );

    expect(repository.recordPublishFailure).toHaveBeenCalledWith(
      "5f360f2e-896c-42b3-81ad-3a691269c031",
      "QUEUE_UNAVAILABLE",
      "Queue publication is temporarily unavailable",
      100,
    );
    expect(repository.markQueued).not.toHaveBeenCalled();
  });
});
