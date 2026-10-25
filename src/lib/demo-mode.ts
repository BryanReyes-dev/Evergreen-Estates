export const DEMO_ACCOUNT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const DEMO_ACCOUNT_RETENTION_NOTICE =
  "This app is not production-ready. Email verification is not configured yet, so development/demo accounts can skip verification. Your account, seller profile, listings, reviews written by the account, saved homes, avatar, and uploaded listing media will be permanently deleted 24 hours after registration.";

/** Demo auth is disabled unless an operator explicitly opts in with this server-side variable. */
export function isDemoAuthBypassEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.ENABLE_DEMO_AUTH_BYPASS === "true";
}
