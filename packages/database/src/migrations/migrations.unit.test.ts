import { describe, expect, it } from "vitest";

import { migrationProvider } from "./provider.js";

describe("migrationProvider", () => {
  it("keeps the initial schema in small ordered migrations", async () => {
    const migrations = await migrationProvider.getMigrations();

    expect(Object.keys(migrations)).toEqual([
      "001_create_organizations",
      "002_create_foundation_jobs",
      "003_add_foundation_job_recovery_indexes",
      "004_create_commercial_commands",
      "005_create_companies",
      "006_create_contacts",
      "007_create_leads",
      "008_create_opportunities",
      "009_create_conversations",
      "010_create_messages",
      "011_create_lead_assignments",
      "012_create_commercial_events",
      "013_add_commercial_integrity_indexes_and_immutability",
      "014_create_commercial_facts",
      "015_create_commercial_decisions",
      "016_create_commercial_decision_facts",
      "017_add_commercial_decision_audit_and_integrity",
    ]);
  });
});
