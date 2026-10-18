
import "server-only";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as relations from "@/db/relations";
import * as tables from "@/db/schema";

const schema = { ...tables, ...relations };

function createAppDatabase() {
  const connectionString = process.env.APP_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Missing APP_DATABASE_URL. Configure it with the dedicated evergreen_app PostgreSQL role; do not use DRIZZLE_DATABASE_URL, AUTH_DATABASE_URL, or DIRECT_URL.",
    );
  }

  // Supabase's shared transaction pooler requires prepared statements
  // to be disabled. Keep each server instance's connection pool small.
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

type AppDatabase = ReturnType<typeof createAppDatabase>;
type AppTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run a database operation with a transaction-local application user ID.
 *
 * Pass only the ID from a verified Better Auth server session.
 * Never pass an ID supplied by the request body.
*/

export async function withAppUserTransaction<T>(
  userId: string,
  operation: (tx: AppTransaction) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("Invalid authenticated user ID.");
  }

  return getAppDrizzleDb().transaction(
    async (tx) => {
      await tx.execute(
        sql`select set_config('app.current_user_id', ${userId}, true)`,
      );

      return operation(tx);
    },
    { isolationLevel: "read committed" },
  );
}

let database: AppDatabase | undefined;

/**
 * Lazily initializes the server-only application-write client.
 *
 * Every mutation must use a transaction and set the verified user's
 * identity transaction-locally before issuing owner-protected writes.
*/

export function getAppDrizzleDb(): AppDatabase {
  if (!database) {
    database = createAppDatabase();
  }

  return database;
}
