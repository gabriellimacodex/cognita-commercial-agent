import { CamelCasePlugin, Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";

import type { DatabaseSchema } from "./schema.js";

const { Pool } = pg;

export interface DatabaseOptions {
  connectionString: string;
  maxConnections?: number;
}

export function validateDatabaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  return value;
}

export function createDatabase(
  options: DatabaseOptions,
): Kysely<DatabaseSchema> {
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: validateDatabaseUrl(options.connectionString),
        max: options.maxConnections ?? 10,
      }),
    }),
    plugins: [new CamelCasePlugin()],
  });
}

export async function checkDatabase(
  database: Kysely<DatabaseSchema>,
): Promise<void> {
  await sql`select 1`.execute(database);
}
