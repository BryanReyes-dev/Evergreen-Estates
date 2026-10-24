import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import { boolean, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import postgres from "postgres";

import { account, session, verification } from "@/db/auth-schema";

const authUsers = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [unique("users_email_key").on(table.email)],
);

// Better Auth's logical "user" model maps to Evergreen's canonical "users" table.
// This client must use the dedicated evergreen_auth login, never the read-only
// evergreen_runtime credentials or the privileged DIRECT_URL migration connection.
export const authSchema = {
  user: authUsers,
  session,
  account,
  verification,
};

function createAuthDatabase() {
  const connectionString = process.env.AUTH_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Missing AUTH_DATABASE_URL. Configure it with the dedicated evergreen_auth PostgreSQL role; do not use DRIZZLE_DATABASE_URL or DIRECT_URL.",
    );
  }

  // Supabase's shared transaction pooler requires prepared statements to be disabled.
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema: authSchema });
}

type AuthDatabase = ReturnType<typeof createAuthDatabase>;

let database: AuthDatabase | undefined;

/** Lazily initialize the auth database connection when auth is first requested. */
export function getAuthDrizzleDb(): AuthDatabase {
  if (!database) {
    database = createAuthDatabase();
  }

  return database;
}
