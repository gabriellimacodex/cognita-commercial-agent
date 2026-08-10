import { sql, type Kysely } from "kysely";

export async function up(database: Kysely<unknown>): Promise<void> {
  await sql`
    create index foundation_jobs_publish_recovery_idx
      on foundation_jobs (next_publish_at, created_at)
      where status in ('pending', 'queued')
  `.execute(database);

  await sql`
    create index foundation_jobs_processing_recovery_idx
      on foundation_jobs (process_lease_expires_at, created_at)
      where status = 'processing'
  `.execute(database);
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await sql`drop index foundation_jobs_processing_recovery_idx`.execute(
    database,
  );
  await sql`drop index foundation_jobs_publish_recovery_idx`.execute(database);
}
