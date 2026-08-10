import type { FoundationJobInput, FoundationJobStatus } from "@cognita/schemas";
import type { ColumnType, Generated, Insertable, Selectable } from "kysely";

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface OrganizationsTable {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FoundationJobsTable {
  id: string;
  idempotencyKey: string;
  requestHash: string;
  input: FoundationJobInput;
  status: Generated<FoundationJobStatus>;
  publishAttempts: Generated<number>;
  processAttempts: Generated<number>;
  nextPublishAt: Timestamp;
  nextProcessAt: Date | null;
  processLeaseExpiresAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  resultAlgorithm: "sha256" | null;
  resultDigest: string | null;
  resultInputBytes: number | null;
  queuedAt: Date | null;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DatabaseSchema {
  organizations: OrganizationsTable;
  foundationJobs: FoundationJobsTable;
}

export type FoundationJobRow = Selectable<FoundationJobsTable>;
export type NewFoundationJobRow = Insertable<FoundationJobsTable>;
