import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { sql } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { after } from "next/server";

import { authSchema, getAuthDrizzleDb } from "@/db/drizzle/auth-client";
import { sendAuthEmail } from "@/lib/auth-email";
import { isDemoAuthBypassEnabled } from "@/lib/demo-mode";

function createAuth(demoModeEnabled: boolean) {
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
      requireEmailVerification: !demoModeEnabled,
      autoSignIn: demoModeEnabled,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        after(async () => {
          try {
            await sendAuthEmail({
              to: user.email,
              subject: "Reset your Evergreen Estates password",
              heading: "Reset your password",
              message: "We received a request to reset the password for your Evergreen Estates account. This link expires in one hour.",
              actionLabel: "Reset password",
              actionUrl: url,
            });
          } catch {
            // Keep responses generic and avoid logging tokens or recipient details.
            console.error("Evergreen Estates authentication email delivery failed.");
          }
        });
      },
    },
    emailVerification: {
      sendOnSignUp: !demoModeEnabled,
      sendOnSignIn: !demoModeEnabled,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        after(async () => {
          try {
            await sendAuthEmail({
              to: user.email,
              subject: "Verify your Evergreen Estates email",
              heading: "Verify your email address",
              message: "Use this link to verify your email address and finish setting up your Evergreen Estates account. The link expires in one hour.",
              actionLabel: "Verify email address",
              actionUrl: url,
            });
          } catch {
            // Keep responses generic and avoid logging tokens or recipient details.
            console.error("Evergreen Estates authentication email delivery failed.");
          }
        });
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 10, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    databaseHooks: demoModeEnabled
      ? {
          user: {
            create: {
              after: async (user) => {
                // Anchor expiry to account creation, not the timing of this hook.
                await getAuthDrizzleDb().execute(sql`
                  UPDATE public.users
                  SET demo_expires_at = created_at + interval '24 hours'
                  WHERE id = ${user.id}
                    AND demo_expires_at IS NULL
                `);
              },
            },
          },
        }
      : undefined,
    advanced: { database: { generateId: "uuid" } },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | undefined;
let authInstanceDemoMode: boolean | undefined;

export function getAuth(): AuthInstance {
  const demoModeEnabled = isDemoAuthBypassEnabled();
  // Rebuild if tests or the server environment change the explicit demo toggle.
  if (!authInstance || authInstanceDemoMode !== demoModeEnabled) {
    authInstance = createAuth(demoModeEnabled);
    authInstanceDemoMode = demoModeEnabled;
  }
  return authInstance;
}
