import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { Migrator } from "kysely/migration";

import {
  createDatabase,
  FoundationJobRepository,
  migrationProvider,
} from "@cognita/database";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl == null) {
  throw new Error("DATABASE_URL is required for integration tests");
}

const database = createDatabase({ connectionString: databaseUrl });
const repository = new FoundationJobRepository(database);

describe("FoundationJobRepository recovery", () => {
  beforeAll(async () => {
    const migrator = new Migrator({
      db: database,
      provider: migrationProvider,
    });
    const result = await migrator.migrateToLatest();
    if (result.error != null) {
      throw result.error instanceof Error
        ? result.error
        : new Error("Foundation migration failed");
    }
  });

  beforeEach(async () => {
    await database.deleteFrom("foundationJobs").execute();
  });

  afterAll(async () => {
    await database.destroy();
  });

  it("claims a processing job when its scheduled retry is due and its lease is released", async () => {
    const id = "5f360f2e-896c-42b3-81ad-3a691269c031";
    await repository.createOrGet({
      id,
      idempotencyKey: "retry-recovery",
      requestHash: "a".repeat(64),
      input: { input: "foundation" },
    });
    const acquired = await repository.acquireForProcessing(id, 5_000);
    expect(acquired).toBeDefined();
    await repository.scheduleProcessRetry(
      id,
      acquired?.processAttempts ?? 0,
      "PROCESSING_RETRY",
      "Foundation job processing will be retried",
      1_000,
    );
    await database
      .updateTable("foundationJobs")
      .set({ nextProcessAt: sql`now() - interval '1 second'` })
      .where("id", "=", id)
      .execute();

    const claimed = await repository.claimRecoverableJobs(10, 5_000);

    expect(claimed.map((job) => job.id)).toEqual([id]);
  });

  it("does not claim the same processing recovery twice during the claim lease", async () => {
    const id = "7579f2fd-b205-4f86-b035-e7be8fb98ea9";
    await repository.createOrGet({
      id,
      idempotencyKey: "exclusive-recovery",
      requestHash: "b".repeat(64),
      input: { input: "foundation" },
    });
    const acquired = await repository.acquireForProcessing(id, 1);
    expect(acquired).toBeDefined();
    await database
      .updateTable("foundationJobs")
      .set({ processLeaseExpiresAt: new Date(0) })
      .where("id", "=", id)
      .execute();

    const firstClaim = await repository.claimRecoverableJobs(10, 5_000);
    const secondClaim = await repository.claimRecoverableJobs(10, 5_000);

    expect(firstClaim.map((job) => job.id)).toEqual([id]);
    expect(secondClaim).toEqual([]);
  });

  it("resolves concurrent idempotent creation through the database constraint", async () => {
    const creations = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        repository.createOrGet({
          id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          idempotencyKey: "concurrent-create",
          requestHash: "c".repeat(64),
          input: { input: "foundation" },
        }),
      ),
    );

    const persistedIds = new Set(creations.map(({ job }) => job.id));
    const persistedCount = await database
      .selectFrom("foundationJobs")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    expect(creations.filter(({ created }) => created)).toHaveLength(1);
    expect(persistedIds.size).toBe(1);
    expect(Number(persistedCount.count)).toBe(1);
  });

  it("does not regress or increment a completed job after duplicate delivery", async () => {
    const id = "9ce63e75-fced-48da-889f-bdef0b78a30c";
    await repository.createOrGet({
      id,
      idempotencyKey: "terminal-redelivery",
      requestHash: "d".repeat(64),
      input: { input: "foundation" },
    });
    const acquired = await repository.acquireForProcessing(id, 5_000);
    expect(acquired).toBeDefined();
    await repository.complete(id, acquired?.processAttempts ?? 0, {
      algorithm: "sha256",
      digest: "e".repeat(64),
      inputBytes: 10,
    });

    const duplicateAcquire = await repository.acquireForProcessing(id, 5_000);
    const persisted = await repository.findById(id);

    expect(duplicateAcquire).toBeUndefined();
    expect(persisted?.status).toBe("completed");
    expect(persisted?.processAttempts).toBe(1);
    expect(persisted?.resultDigest).toBe("e".repeat(64));
  });
});
