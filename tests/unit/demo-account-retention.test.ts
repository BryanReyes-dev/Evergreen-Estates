import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  cleanupExpiredDemoAccounts,
  type DemoAccountCleanupDependencies,
  type ExpiredDemoAccount,
} from "@/lib/demo-account-cleanup";
import {
  DEMO_ACCOUNT_LIFETIME_MS,
  DEMO_ACCOUNT_RETENTION_NOTICE,
  isDemoAuthBypassEnabled,
} from "@/lib/demo-mode";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const LISTING_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeDependencies(
  accounts: ExpiredDemoAccount[] = [{ id: USER_A, image: null }],
): DemoAccountCleanupDependencies {
  return {
    listExpiredAccounts: vi.fn(async () => accounts),
    tryLock: vi.fn(async () => true),
    releaseLock: vi.fn(async () => {}),
    getOwnedListings: vi.fn(async () => [{ id: LISTING_A }]),
    deleteListingMedia: vi.fn(async () => {}),
    deleteUserMedia: vi.fn(async () => {}),
    deleteExpiredAccount: vi.fn(async () => true),
  };
}

describe("temporary demo account retention", () => {
  it("uses a 24-hour lifetime and leaves bypass disabled unless explicitly enabled", () => {
    expect(DEMO_ACCOUNT_LIFETIME_MS).toBe(24 * 60 * 60 * 1000);
    expect(isDemoAuthBypassEnabled({})).toBe(false);
    expect(isDemoAuthBypassEnabled({ ENABLE_DEMO_AUTH_BYPASS: "false" })).toBe(false);
    expect(isDemoAuthBypassEnabled({ ENABLE_DEMO_AUTH_BYPASS: "true" })).toBe(true);
    expect(DEMO_ACCOUNT_RETENTION_NOTICE).toContain("not production-ready");
    expect(DEMO_ACCOUNT_RETENTION_NOTICE).toContain("24 hours");
  });

  it("removes listing media and the owned avatar before deleting the database identity", async () => {
    const events: string[] = [];
    const dependencies = makeDependencies();
    dependencies.listExpiredAccounts = vi.fn(async () => [{ id: USER_A, image: "avatars/" + USER_A + "/avatar.jpg" }]);
    dependencies.getOwnedListings = vi.fn(async () => [{ id: LISTING_A }]);
    dependencies.deleteListingMedia = vi.fn(async () => { events.push("listing-media"); });
    dependencies.deleteUserMedia = vi.fn(async () => { events.push("avatar"); });
    dependencies.deleteExpiredAccount = vi.fn(async () => { events.push("database-account"); return true; });
    dependencies.releaseLock = vi.fn(async () => { events.push("unlock"); });

    const summary = await cleanupExpiredDemoAccounts(dependencies);

    expect(events).toEqual(["listing-media", "avatar", "database-account", "unlock"]);
    expect(summary).toEqual({ found: 1, deleted: 1, skipped: 0, failed: 0 });
    expect(dependencies.listExpiredAccounts).toHaveBeenCalledWith(5);
  });

  it("keeps account rows when storage deletion fails and continues with later accounts", async () => {
    const dependencies = makeDependencies([{ id: USER_A, image: null }, { id: USER_B, image: null }]);
    dependencies.deleteListingMedia = vi.fn(async (listingId) => {
      if (listingId === LISTING_A) throw new Error("storage unavailable");
    });
    dependencies.getOwnedListings = vi.fn(async (userId) =>
      userId === USER_A ? [{ id: LISTING_A }] : [],
    );

    const summary = await cleanupExpiredDemoAccounts(dependencies);

    expect(dependencies.deleteExpiredAccount).toHaveBeenCalledTimes(1);
    expect(dependencies.deleteExpiredAccount).toHaveBeenCalledWith(USER_B);
    expect(summary).toEqual({ found: 2, deleted: 1, skipped: 0, failed: 1 });
  });

  it("does not start cleanup when another scheduled run holds the account lock", async () => {
    const dependencies = makeDependencies();
    dependencies.tryLock = vi.fn(async () => false);

    const summary = await cleanupExpiredDemoAccounts(dependencies);

    expect(dependencies.getOwnedListings).not.toHaveBeenCalled();
    expect(dependencies.deleteListingMedia).not.toHaveBeenCalled();
    expect(dependencies.deleteExpiredAccount).not.toHaveBeenCalled();
    expect(dependencies.releaseLock).not.toHaveBeenCalled();
    expect(summary).toEqual({ found: 1, deleted: 0, skipped: 1, failed: 0 });
  });

  it("documents the development-only skip button and schedules cleanup", () => {
    const form = readFileSync(new URL("../../src/components/forms/AuthForm.tsx", import.meta.url), "utf8");
    const scheduledFunction = readFileSync(new URL("../../netlify/functions/cleanup-demo-accounts.ts", import.meta.url), "utf8");
    const migration = readFileSync(new URL("../../drizzle/0022_demo_account_retention.sql", import.meta.url), "utf8");
    const fixtureExclusionMigration = readFileSync(new URL("../../drizzle/0024_exclude_seed_accounts_from_demo_cleanup.sql", import.meta.url), "utf8");
    const expiryPermissionsMigration = readFileSync(new URL("../../drizzle/0025_auth_demo_expiry_column_grants.sql", import.meta.url), "utf8");
    const auth = readFileSync(new URL("../../src/lib/auth.ts", import.meta.url), "utf8");

    expect(auth).toContain("DEMO_ACCOUNT_LIFETIME_MS / 1000");
    expect(auth).toContain("created_at + make_interval");
    expect(form).toContain("Skip email verification and continue");
    expect(form).toContain("DEMO_ACCOUNT_RETENTION_NOTICE");
    expect(scheduledFunction).toContain('schedule: "*/15 * * * *"');
    expect(scheduledFunction).toContain("private.list_expired_demo_accounts($1)");
    expect(migration).toContain("private.delete_expired_demo_account");
    expect(migration).toContain("demo_expires_at <= pg_catalog.now()");
    expect(fixtureExclusionMigration).toContain("private.list_expired_demo_accounts");
    expect(fixtureExclusionMigration).toContain("demo_expires_at <= pg_catalog.now()");
    expect(fixtureExclusionMigration).toContain("private.delete_expired_demo_account");
    expect(fixtureExclusionMigration).toContain("daniel.carter@example.com");
    expect(fixtureExclusionMigration).toContain("maya.thompson@example.com");
    expect(fixtureExclusionMigration).toContain("jordan.lee@example.com");
    expect(fixtureExclusionMigration).toContain("priya.patel@example.com");
    expect(expiryPermissionsMigration).toContain("GRANT SELECT (demo_expires_at) ON TABLE public.users TO evergreen_auth;");
    expect(expiryPermissionsMigration).toContain("GRANT UPDATE (demo_expires_at) ON TABLE public.users TO evergreen_auth;");
    expect(expiryPermissionsMigration).not.toContain("GRANT UPDATE ON TABLE public.users TO evergreen_auth;");
  });
});
