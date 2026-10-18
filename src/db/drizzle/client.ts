import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as relations from "@/db/relations";
import * as tables from "@/db/schema";

const schema = { ...tables, ...relations };

function createDatabase() {
  const connectionString = process.env.DRIZZLE_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Missing DRIZZLE_DATABASE_URL. Configure it with the dedicated evergreen_runtime PostgreSQL role; do not use the migration/admin connection."
    );
  }

  // The Supabase transaction pooler does not support server-side prepared statements.
  // max: 1 avoids opening a large pool per serverless function instance.
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

type AppDatabase = ReturnType<typeof createDatabase>;

let database: AppDatabase | undefined;

/**
 * Lazily initializes the server-only Drizzle client.
 * Keeping initialization lazy allows Next.js builds to complete without
 * a runtime database URL; queries fail clearly if the variable is not set.
*/

export function getDrizzleDb(): AppDatabase {
  if (!database) {
    database = createDatabase();
  }

  return database;
}


