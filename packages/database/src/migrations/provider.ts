import type { Migration, MigrationProvider } from "kysely/migration";

import * as createOrganizations from "./001-create-organizations.js";
import * as createFoundationJobs from "./002-create-foundation-jobs.js";
import * as addFoundationJobRecoveryIndexes from "./003-add-foundation-job-recovery-indexes.js";

export const migrationProvider: MigrationProvider = {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({
      "001_create_organizations": createOrganizations,
      "002_create_foundation_jobs": createFoundationJobs,
      "003_add_foundation_job_recovery_indexes":
        addFoundationJobRecoveryIndexes,
    });
  },
};
