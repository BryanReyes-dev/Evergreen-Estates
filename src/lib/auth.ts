import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { authSchema, getAuthDrizzleDb } from "@/db/drizzle/auth-client";
import { sendAuthEmail } from "@/lib/auth-email";

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
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: "Reset your Evergreen Estates password",
          heading: "Reset your password",
          message: "We received a request to reset the password for your Evergreen Estates account. This link expires in one hour.",
          actionLabel: "Reset password",
          actionUrl: url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: "Verify your Evergreen Estates email",
          heading: "Verify your email address",
          message: "Use this link to verify your email address and finish setting up your Evergreen Estates account. The link expires in one hour.",
          actionLabel: "Verify email address",
          actionUrl: url,
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
    advanced: { database: { generateId: "uuid" } },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (!authInstance) authInstance = createAuth();
  return authInstance;
}
