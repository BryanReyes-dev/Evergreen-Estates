import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { authSchema, getAuthDrizzleDb } from "@/db/drizzle/auth-client";

function createAuth() {
  return betterAuth({
    appName: "Evergreen Estates",

    baseURL: process.env.BETTER_AUTH_URL,

    secret: process.env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(getAuthDrizzleDb(), {
      provider: "pg",
      // Map Better Auth's logical "user" model to the existing public.users table.
      schema: authSchema,
    }),

    emailAndPassword: {
      enabled: true,
    },

    advanced: {
      database: {
        generateId: "uuid",
      },
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;

let authInstance: AuthInstance | undefined;

/**
 * Create Better Auth only when an auth request needs it. This keeps builds and
 * non-auth routes from failing merely because AUTH_DATABASE_URL is not set yet.
 */
export function getAuth(): AuthInstance {
  if (!authInstance) {
    authInstance = createAuth();
  }

  return authInstance;
}
