export type ExpiredDemoAccount = {
  id: string;
  image: string | null;
};

export type ExpiredDemoListing = {
  id: string;
};

export type DemoAccountCleanupDependencies = {
  listExpiredAccounts(limit: number): Promise<ExpiredDemoAccount[]>;
  tryLock(userId: string): Promise<boolean>;
  releaseLock(userId: string): Promise<void>;
  getOwnedListings(userId: string): Promise<ExpiredDemoListing[]>;
  deleteListingMedia(listingId: string): Promise<void>;
  deleteUserMedia(account: ExpiredDemoAccount): Promise<void>;
  deleteExpiredAccount(userId: string): Promise<boolean>;
};

export type DemoAccountCleanupSummary = {
  found: number;
  deleted: number;
  skipped: number;
  failed: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Purges storage objects first and the database identity second. If any storage
 * cleanup fails, the account remains so the next scheduled run can retry.
 */
export async function cleanupExpiredDemoAccounts(
  dependencies: DemoAccountCleanupDependencies,
  limit = 5,
): Promise<DemoAccountCleanupSummary> {
  const accounts = await dependencies.listExpiredAccounts(limit);
  const summary: DemoAccountCleanupSummary = {
    found: accounts.length,
    deleted: 0,
    skipped: 0,
    failed: 0,
  };

  for (const account of accounts) {
    if (!UUID_PATTERN.test(account.id)) {
      summary.failed += 1;
      continue;
    }

    let locked = false;
    try {
      locked = await dependencies.tryLock(account.id);
      if (!locked) {
        summary.skipped += 1;
        continue;
      }

      const listings = await dependencies.getOwnedListings(account.id);
      for (const listing of listings) {
        if (!UUID_PATTERN.test(listing.id)) {
          throw new Error("Invalid listing ID returned during demo cleanup.");
        }
        await dependencies.deleteListingMedia(listing.id);
      }

      await dependencies.deleteUserMedia(account);
      if (await dependencies.deleteExpiredAccount(account.id)) {
        summary.deleted += 1;
      } else {
        summary.skipped += 1;
      }
    } catch {
      // Keep logs free of email addresses, account IDs, and Storage object paths.
      summary.failed += 1;
    } finally {
      if (locked) {
        try {
          await dependencies.releaseLock(account.id);
        } catch {
          summary.failed += 1;
        }
      }
    }
  }

  return summary;
}
