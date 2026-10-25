import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn((options: unknown) => ({ options })),
  drizzleAdapter: vi.fn(() => ({ kind: "mock-drizzle-adapter" })),
  getAuthDrizzleDb: vi.fn(() => ({})),
  after: vi.fn(),
  sendAuthEmail: vi.fn(),
}));

vi.mock("better-auth", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: mocks.drizzleAdapter,
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/db/drizzle/auth-client", () => ({
  authSchema: {},
  getAuthDrizzleDb: mocks.getAuthDrizzleDb,
}));
vi.mock("@/lib/auth-email", () => ({ sendAuthEmail: mocks.sendAuthEmail }));

import { getAuth } from "@/lib/auth";

type TestedAuthOptions = {
  emailAndPassword: {
    enabled: boolean;
    requireEmailVerification: boolean;
    autoSignIn: boolean;
    resetPasswordTokenExpiresIn: number;
    revokeSessionsOnPasswordReset: boolean;
  };
  emailVerification: {
    sendOnSignUp: boolean;
    sendOnSignIn: boolean;
    autoSignInAfterVerification: boolean;
    expiresIn: number;
  };
  rateLimit: {
    enabled: boolean;
    customRules: Record<string, { window: number; max: number }>;
  };
};

function authOptions(): TestedAuthOptions {
  const auth = getAuth() as unknown as { options: TestedAuthOptions };
  return auth.options;
}

describe("Better Auth security configuration", () => {
  it("requires email verification and disables sign-in before verification", () => {
    const options = authOptions();

    expect(options.emailAndPassword.enabled).toBe(true);
    expect(options.emailAndPassword.requireEmailVerification).toBe(true);
    expect(options.emailAndPassword.autoSignIn).toBe(false);
    expect(options.emailVerification.sendOnSignUp).toBe(true);
    expect(options.emailVerification.sendOnSignIn).toBe(true);
    expect(options.emailVerification.autoSignInAfterVerification).toBe(true);
  });

  it("expires verification and password-reset tokens after one hour", () => {
    const options = authOptions();

    expect(options.emailVerification.expiresIn).toBe(60 * 60);
    expect(options.emailAndPassword.resetPasswordTokenExpiresIn).toBe(60 * 60);
  });

  it("revokes sessions after a password reset", () => {
    expect(authOptions().emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
  });

  it("enables rate limiting for sign-in, sign-up, verification, and password reset", () => {
    const options = authOptions();

    expect(options.rateLimit.enabled).toBe(true);
    expect(options.rateLimit.customRules["/sign-in/email"]).toEqual({
      window: 10,
      max: 5,
    });
    expect(options.rateLimit.customRules["/sign-up/email"]).toEqual({
      window: 60,
      max: 5,
    });
    expect(options.rateLimit.customRules["/send-verification-email"]).toEqual({
      window: 60,
      max: 3,
    });
    expect(options.rateLimit.customRules["/request-password-reset"]).toEqual({
      window: 60,
      max: 3,
    });
  });
});
