import { Migrator, NO_MIGRATIONS } from "kysely/migration";

import { createDatabase } from "./connection.js";
import { migrationProvider } from "./migrations/provider.js";

const direction = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl == null) {
  throw new Error("DATABASE_URL is required");
}

if (direction !== "up" && direction !== "down") {
  throw new Error("Migration direction must be up or down");
}

const database = createDatabase({
  connectionString: databaseUrl,
  maxConnections: 2,
});
const migrator = new Migrator({ db: database, provider: migrationProvider });

try {
  const result =
    direction === "up"
      ? await migrator.migrateToLatest()
      : await migrator.migrateTo(NO_MIGRATIONS);

  for (const migration of result.results ?? []) {
    process.stdout.write(
      `${migration.direction} ${migration.migrationName}: ${migration.status}\n`,
    );
  }

  if (result.error != null) {
    throw result.error instanceof Error
      ? result.error
      : new Error("Migration failed with a non-error value");
  }
} finally {
  await database.destroy();
}
