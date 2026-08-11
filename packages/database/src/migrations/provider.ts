import type { Migration, MigrationProvider } from "kysely/migration";

import * as createOrganizations from "./001-create-organizations.js";
import * as createFoundationJobs from "./002-create-foundation-jobs.js";
import * as addFoundationJobRecoveryIndexes from "./003-add-foundation-job-recovery-indexes.js";
import * as createCommercialCommands from "./004-create-commercial-commands.js";
import * as createCompanies from "./005-create-companies.js";
import * as createContacts from "./006-create-contacts.js";
import * as createLeads from "./007-create-leads.js";
import * as createOpportunities from "./008-create-opportunities.js";
import * as createConversations from "./009-create-conversations.js";
import * as createMessages from "./010-create-messages.js";
import * as createLeadAssignments from "./011-create-lead-assignments.js";
import * as createCommercialEvents from "./012-create-commercial-events.js";
import * as addCommercialIntegrity from "./013-add-commercial-integrity-indexes-and-immutability.js";

export const migrationProvider: MigrationProvider = {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({
      "001_create_organizations": createOrganizations,
      "002_create_foundation_jobs": createFoundationJobs,
      "003_add_foundation_job_recovery_indexes":
        addFoundationJobRecoveryIndexes,
      "004_create_commercial_commands": createCommercialCommands,
      "005_create_companies": createCompanies,
      "006_create_contacts": createContacts,
      "007_create_leads": createLeads,
      "008_create_opportunities": createOpportunities,
      "009_create_conversations": createConversations,
      "010_create_messages": createMessages,
      "011_create_lead_assignments": createLeadAssignments,
      "012_create_commercial_events": createCommercialEvents,
      "013_add_commercial_integrity_indexes_and_immutability":
        addCommercialIntegrity,
    });
  },
};
