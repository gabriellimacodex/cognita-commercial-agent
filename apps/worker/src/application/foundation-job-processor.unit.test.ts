import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { FoundationJobRow } from "@cognita/database";

import { FoundationJobProcessor } from "./foundation-job-processor.js";

const processingJob: FoundationJobRow = {
  id: "5f360f2e-896c-42b3-81ad-3a691269c031",
  idempotencyKey: "request-1",
  requestHash: "a".repeat(64),
  input: { input: "foundation" },
  status: "processing",
  publishAttempts: 1,
  processAttempts: 1,
  nextPublishAt: new Date("2026-08-10T12:00:00.000Z"),
  nextProcessAt: null,
  processLeaseExpiresAt: new Date("2026-08-10T12:01:00.000Z"),
  lastErrorCode: null,
  lastErrorMessage: null,
  resultAlgorithm: null,
  resultDigest: null,
  resultInputBytes: null,
  queuedAt: new Date("2026-08-10T12:00:00.000Z"),
  processingStartedAt: new Date("2026-08-10T12:00:01.000Z"),
  completedAt: null,
  failedAt: null,
  createdAt: new Date("2026-08-10T12:00:00.000Z"),
  updatedAt: new Date("2026-08-10T12:00:01.000Z"),
};

describe("FoundationJobProcessor", () => {
  it("persists the deterministic SHA-256 result", async () => {
    const repository = {
      acquireForProcessing: vi.fn(async () => processingJob),
      complete: vi.fn(async () => true),
      scheduleProcessRetry: vi.fn(async () => true),
      fail: vi.fn(async () => true),
    };
    const processor = new FoundationJobProcessor(repository, {
      leaseMs: 5_000,
      retryAfterMs: 100,
    });

    await processor.process(
      { jobId: processingJob.id, correlationId: "correlation-1" },
      { attempt: 1, maxAttempts: 3 },
    );

    expect(repository.complete).toHaveBeenCalledWith(processingJob.id, 1, {
      algorithm: "sha256",
      digest: createHash("sha256").update("foundation").digest("hex"),
      inputBytes: Buffer.byteLength("foundation"),
    });
  });

  it("releases the processing lease for a retry after a transient failure", async () => {
    const repository = {
      acquireForProcessing: vi.fn(async () => processingJob),
      complete: vi.fn(async () => {
        throw new Error("database write failed");
      }),
      scheduleProcessRetry: vi.fn(async () => true),
      fail: vi.fn(async () => true),
    };
    const processor = new FoundationJobProcessor(repository, {
      leaseMs: 5_000,
      retryAfterMs: 100,
    });

    await expect(
      processor.process(
        { jobId: processingJob.id, correlationId: "correlation-1" },
        { attempt: 1, maxAttempts: 3 },
      ),
    ).rejects.toThrow("database write failed");

    expect(repository.scheduleProcessRetry).toHaveBeenCalledWith(
      processingJob.id,
      1,
      "PROCESSING_RETRY",
      "Foundation job processing will be retried",
      100,
    );
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("treats a duplicate delivery of a terminal job as a no-op", async () => {
    const repository = {
      acquireForProcessing: vi.fn(async () => undefined),
      complete: vi.fn(async () => true),
      scheduleProcessRetry: vi.fn(async () => true),
      fail: vi.fn(async () => true),
    };
    const processor = new FoundationJobProcessor(repository, {
      leaseMs: 5_000,
      retryAfterMs: 100,
    });

    await processor.process(
      { jobId: processingJob.id, correlationId: "correlation-1" },
      { attempt: 2, maxAttempts: 3 },
    );

    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.scheduleProcessRetry).not.toHaveBeenCalled();
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("persists a terminal failure after the final processing attempt", async () => {
    const repository = {
      acquireForProcessing: vi.fn(async () => processingJob),
      complete: vi.fn(async () => {
        throw new Error("database write failed");
      }),
      scheduleProcessRetry: vi.fn(async () => true),
      fail: vi.fn(async () => true),
    };
    const processor = new FoundationJobProcessor(repository, {
      leaseMs: 5_000,
      retryAfterMs: 100,
    });

    await expect(
      processor.process(
        { jobId: processingJob.id, correlationId: "correlation-final" },
        { attempt: 3, maxAttempts: 3 },
      ),
    ).rejects.toThrow("database write failed");

    expect(repository.fail).toHaveBeenCalledWith(
      processingJob.id,
      1,
      "PROCESSING_FAILED",
      "Foundation job processing failed",
    );
    expect(repository.scheduleProcessRetry).not.toHaveBeenCalled();
  });
});
