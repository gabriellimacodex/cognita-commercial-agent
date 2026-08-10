import { describe, expect, it } from "vitest";

import type { FoundationJobRow } from "@cognita/database";

import {
  FoundationJobService,
  hashFoundationJobInput,
  IdempotencyConflictError,
} from "./foundation-job-service.js";

const pendingJob: FoundationJobRow = {
  id: "5f360f2e-896c-42b3-81ad-3a691269c031",
  idempotencyKey: "request-1",
  requestHash: "a".repeat(64),
  input: { input: "foundation" },
  status: "pending",
  publishAttempts: 0,
  processAttempts: 0,
  nextPublishAt: new Date("2026-08-10T12:00:00.000Z"),
  nextProcessAt: null,
  processLeaseExpiresAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  resultAlgorithm: null,
  resultDigest: null,
  resultInputBytes: null,
  queuedAt: null,
  processingStartedAt: null,
  completedAt: null,
  failedAt: null,
  createdAt: new Date("2026-08-10T12:00:00.000Z"),
  updatedAt: new Date("2026-08-10T12:00:00.000Z"),
};

describe("FoundationJobService", () => {
  it("persists a new job before publishing it", async () => {
    const events: string[] = [];
    const repository = {
      async createOrGet() {
        events.push("persisted");
        return { created: true, job: pendingJob };
      },
      async findById() {
        return pendingJob;
      },
    };
    const publisher = {
      async publish() {
        events.push("published");
      },
    };
    const service = new FoundationJobService(
      repository,
      publisher,
      () => pendingJob.id,
    );

    await service.create({ input: "foundation" }, "request-1", "correlation-1");

    expect(events).toEqual(["persisted", "published"]);
  });
});

it("returns an idempotent replay without publishing again", async () => {
  let publications = 0;
  const repository = {
    async createOrGet() {
      return {
        created: false,
        job: {
          ...pendingJob,
          requestHash: hashFoundationJobInput({ input: "foundation" }),
        },
      };
    },
    async findById() {
      return pendingJob;
    },
  };
  const service = new FoundationJobService(repository, {
    async publish() {
      publications += 1;
    },
  });

  await service.create({ input: "foundation" }, "request-1", "correlation-1");

  expect(publications).toBe(0);
});

it("rejects an idempotency key reused with different input", async () => {
  const repository = {
    async createOrGet() {
      return { created: false, job: pendingJob };
    },
    async findById() {
      return pendingJob;
    },
  };
  const service = new FoundationJobService(repository, {
    async publish() {},
  });

  await expect(
    service.create(
      { input: "different" },
      pendingJob.idempotencyKey,
      "correlation-1",
    ),
  ).rejects.toBeInstanceOf(IdempotencyConflictError);
});
