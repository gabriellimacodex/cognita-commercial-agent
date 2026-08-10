import type { FoundationJob, FoundationJobInput } from "@cognita/schemas";
import { type Kysely, type Transaction, sql } from "kysely";

import type { DatabaseSchema, FoundationJobRow } from "./schema.js";

export interface CreateFoundationJobRecord {
  id: string;
  idempotencyKey: string;
  requestHash: string;
  input: FoundationJobInput;
}

export interface CreatedOrExistingJob {
  created: boolean;
  job: FoundationJobRow;
}

export interface JobResultRecord {
  algorithm: "sha256";
  digest: string;
  inputBytes: number;
}

type DatabaseExecutor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function serializeFoundationJob(row: FoundationJobRow): FoundationJob {
  const result =
    row.resultAlgorithm === "sha256" &&
    row.resultDigest != null &&
    row.resultInputBytes != null
      ? {
          algorithm: row.resultAlgorithm,
          digest: row.resultDigest,
          inputBytes: row.resultInputBytes,
        }
      : null;

  return {
    id: row.id,
    status: row.status,
    publishAttempts: row.publishAttempts,
    processAttempts: row.processAttempts,
    lastErrorCode: row.lastErrorCode,
    queuedAt: toIso(row.queuedAt),
    processingStartedAt: toIso(row.processingStartedAt),
    completedAt: toIso(row.completedAt),
    failedAt: toIso(row.failedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    result,
  };
}

export class FoundationJobRepository {
  public constructor(private readonly database: Kysely<DatabaseSchema>) {}

  public async createOrGet(
    record: CreateFoundationJobRecord,
  ): Promise<CreatedOrExistingJob> {
    return this.database.transaction().execute(async (transaction) => {
      const inserted = await transaction
        .insertInto("foundationJobs")
        .values({
          ...record,
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
        })
        .onConflict((conflict) => conflict.column("idempotencyKey").doNothing())
        .returningAll()
        .executeTakeFirst();

      if (inserted != null) {
        return { created: true, job: inserted };
      }

      const existing = await this.findByIdempotencyKey(
        transaction,
        record.idempotencyKey,
      );
      if (existing == null) {
        throw new Error("Idempotency conflict did not return an existing job");
      }
      return { created: false, job: existing };
    });
  }

  public async findById(id: string): Promise<FoundationJobRow | undefined> {
    return this.database
      .selectFrom("foundationJobs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  public async reservePublishAttempt(id: string): Promise<boolean> {
    const updated = await this.database
      .updateTable("foundationJobs")
      .set({
        publishAttempts: sql`publish_attempts + 1`,
        updatedAt: sql`now()`,
      })
      .where("id", "=", id)
      .where("status", "not in", ["completed", "failed"])
      .returning("id")
      .executeTakeFirst();
    return updated != null;
  }

  public async markQueued(id: string, recoverAfterMs: number): Promise<void> {
    await this.database
      .updateTable("foundationJobs")
      .set({
        status: "queued",
        queuedAt: sql`coalesce(queued_at, now())`,
        nextPublishAt: sql`now() + (${recoverAfterMs} * interval '1 millisecond')`,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: sql`now()`,
      })
      .where("id", "=", id)
      .where("status", "=", "pending")
      .execute();
  }

  public async recordPublishFailure(
    id: string,
    errorCode: string,
    safeMessage: string,
    retryAfterMs: number,
  ): Promise<void> {
    await this.database
      .updateTable("foundationJobs")
      .set({
        lastErrorCode: errorCode,
        lastErrorMessage: safeMessage,
        nextPublishAt: sql`now() + (${retryAfterMs} * interval '1 millisecond')`,
        updatedAt: sql`now()`,
      })
      .where("id", "=", id)
      .where("status", "=", "pending")
      .execute();
  }

  public async acquireForProcessing(
    id: string,
    leaseMs: number,
  ): Promise<FoundationJobRow | undefined> {
    return this.database
      .updateTable("foundationJobs")
      .set({
        status: "processing",
        processAttempts: sql`process_attempts + 1`,
        processingStartedAt: sql`coalesce(processing_started_at, now())`,
        processLeaseExpiresAt: sql`now() + (${leaseMs} * interval '1 millisecond')`,
        nextProcessAt: null,
        updatedAt: sql`now()`,
      })
      .where("id", "=", id)
      .where((expression) =>
        expression.or([
          expression("status", "in", ["pending", "queued"]),
          expression.and([
            expression("status", "=", "processing"),
            expression.or([
              expression("processLeaseExpiresAt", "is", null),
              expression("processLeaseExpiresAt", "<=", sql<Date>`now()`),
            ]),
            expression.or([
              expression("nextProcessAt", "is", null),
              expression("nextProcessAt", "<=", sql<Date>`now()`),
            ]),
          ]),
        ]),
      )
      .returningAll()
      .executeTakeFirst();
  }

  public async complete(
    id: string,
    expectedAttempt: number,
    result: JobResultRecord,
  ): Promise<boolean> {
    const updated = await this.database
      .updateTable("foundationJobs")
      .set({
        status: "completed",
        resultAlgorithm: result.algorithm,
        resultDigest: result.digest,
        resultInputBytes: result.inputBytes,
        completedAt: sql`now()`,
        processLeaseExpiresAt: null,
        nextProcessAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: sql`now()`,
      })
      .where("id", "=", id)
      .where("status", "=", "processing")
      .where("processAttempts", "=", expectedAttempt)
      .returning("id")
      .executeTakeFirst();
    return updated != null;
  }

  public async scheduleProcessRetry(
    id: string,
    expectedAttempt: number,
    errorCode: string,
    safeMessage: string,
    retryAfterMs: number,
  ): Promise<boolean> {
    const updated = await this.database
      .updateTable("foundationJobs")
      .set({
        nextProcessAt: sql`now() + (${retryAfterMs} * interval '1 millisecond')`,
        processLeaseExpiresAt: null,
        lastErrorCode: errorCode,
        lastErrorMessage: safeMessage,
        updatedAt: sql`now()`,
      })
      .where("id", "=", id)
      .where("status", "=", "processing")
      .where("processAttempts", "=", expectedAttempt)
      .returning("id")
      .executeTakeFirst();
    return updated != null;
  }

  public async fail(
    id: string,
    expectedAttempt: number,
    errorCode: string,
    safeMessage: string,
  ): Promise<boolean> {
    const updated = await this.database
      .updateTable("foundationJobs")
      .set({
        status: "failed",
        failedAt: sql`now()`,
        processLeaseExpiresAt: null,
        nextProcessAt: null,
        lastErrorCode: errorCode,
        lastErrorMessage: safeMessage,
        updatedAt: sql`now()`,
      })
      .where("id", "=", id)
      .where("status", "=", "processing")
      .where("processAttempts", "=", expectedAttempt)
      .returning("id")
      .executeTakeFirst();
    return updated != null;
  }

  public async claimRecoverableJobs(
    limit: number,
    claimMs: number,
  ): Promise<FoundationJobRow[]> {
    return this.database.transaction().execute(async (transaction) => {
      const jobs = await transaction
        .selectFrom("foundationJobs")
        .selectAll()
        .where((expression) =>
          expression.or([
            expression.and([
              expression("status", "in", ["pending", "queued"]),
              expression("nextPublishAt", "<=", sql<Date>`now()`),
            ]),
            expression.and([
              expression("status", "=", "processing"),
              expression("nextPublishAt", "<=", sql<Date>`now()`),
              expression.or([
                expression("processLeaseExpiresAt", "is", null),
                expression("processLeaseExpiresAt", "<=", sql<Date>`now()`),
              ]),
              expression.or([
                expression("nextProcessAt", "is", null),
                expression("nextProcessAt", "<=", sql<Date>`now()`),
              ]),
            ]),
          ]),
        )
        .orderBy("createdAt", "asc")
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();

      for (const job of jobs) {
        await transaction
          .updateTable("foundationJobs")
          .set({
            nextPublishAt: sql`now() + (${claimMs} * interval '1 millisecond')`,
            updatedAt: sql`now()`,
          })
          .where("id", "=", job.id)
          .execute();
      }
      return jobs;
    });
  }

  private async findByIdempotencyKey(
    database: DatabaseExecutor,
    idempotencyKey: string,
  ): Promise<FoundationJobRow | undefined> {
    return database
      .selectFrom("foundationJobs")
      .selectAll()
      .where("idempotencyKey", "=", idempotencyKey)
      .executeTakeFirst();
  }
}
