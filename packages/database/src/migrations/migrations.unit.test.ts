import { describe, expect, it } from "vitest";

import { migrationProvider } from "./provider.js";

describe("migrationProvider", () => {
  it("keeps the initial schema in small ordered migrations", async () => {
    const migrations = await migrationProvider.getMigrations();

    expect(Object.keys(migrations)).toEqual([
      "001_create_organizations",
      "002_create_foundation_jobs",
      "003_add_foundation_job_recovery_indexes",
    ]);
  });
});
