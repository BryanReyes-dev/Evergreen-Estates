import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import {
  cleanupExpiredDemoAccounts,
  type ExpiredDemoAccount,
  type ExpiredDemoListing,
} from "../../src/lib/demo-account-cleanup";

const STORAGE_BUCKET = "property-images";
const ACCOUNT_BATCH_SIZE = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Netlify invokes this cleanup job every 15 minutes. */
export const config = { schedule: "*/15 * * * *" };

export default async function cleanupDemoAccounts(): Promise<Response> {
  let authDb: ReturnType<typeof postgres> | undefined;
  let appDb: ReturnType<typeof postgres> | undefined;

  try {
    const authUrl = process.env.AUTH_DATABASE_URL;
    const appUrl = process.env.APP_DATABASE_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
    if (!authUrl || !appUrl || !supabaseUrl || !supabaseSecret) {
      throw new Error("Missing demo cleanup configuration.");
    }

    authDb = postgres(authUrl, {
      prepare: false,
      max: 1,
      // Keep the session-level advisory lock alive during Storage cleanup.
      idle_timeout: 0,
      connect_timeout: 10,
    });
    appDb = postgres(appUrl, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    const storageAdmin = createClient(supabaseUrl, supabaseSecret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const bucket = storageAdmin.storage.from(STORAGE_BUCKET);

    async function removeStorageFolder(folder: string): Promise<void> {
      const filenames: string[] = [];
      let offset = 0;
      // Read all pages before deleting so offset pagination cannot skip files.
      while (true) {
        const { data, error } = await bucket.list(folder, {
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) throw new Error("Unable to list demo account media.");
        const entries = data ?? [];
        filenames.push(
          ...entries
            .map((entry) => entry.name)
            .filter((name) => typeof name === "string" && name.length > 0 && !name.includes("/") && name !== "." && name !== ".."),
        );
        if (entries.length < 1000) break;
        offset += entries.length;
      }

      const paths = filenames.map((filename) => folder + "/" + filename);
      for (let index = 0; index < paths.length; index += 100) {
        const { error } = await bucket.remove(paths.slice(index, index + 100));
        if (error) throw new Error("Unable to remove demo account media.");
      }
    }

    function hasOwnedAvatar(account: ExpiredDemoAccount): boolean {
      return Boolean(
        account.image &&
        UUID_PATTERN.test(account.id) &&
        account.image.startsWith("avatars/" + account.id + "/") &&
        account.image.split("/").length === 3,
      );
    }

    const dependencies = {
      listExpiredAccounts: async (limit: number): Promise<ExpiredDemoAccount[]> => {
        const rows = await authDb!.unsafe(
          "SELECT id::text AS id, image FROM public.users WHERE demo_expires_at IS NOT NULL AND demo_expires_at <= now() ORDER BY demo_expires_at LIMIT $1",
          [limit],
        );
        return rows.map((row) => ({
          id: String(row.id),
          image: typeof row.image === "string" ? row.image : null,
        }));
      },
      tryLock: async (userId: string): Promise<boolean> => {
        const rows = await authDb!.unsafe(
          "SELECT pg_try_advisory_lock(pg_catalog.hashtextextended($1, 0)) AS acquired",
          [userId],
        );
        return rows[0]?.acquired === true;
      },
      releaseLock: async (userId: string): Promise<void> => {
        const rows = await authDb!.unsafe(
          "SELECT pg_advisory_unlock(pg_catalog.hashtextextended($1, 0)) AS released",
          [userId],
        );
        if (rows[0]?.released !== true) throw new Error("Demo cleanup lock was not held.");
      },
      getOwnedListings: async (userId: string): Promise<ExpiredDemoListing[]> => {
        if (!UUID_PATTERN.test(userId)) throw new Error("Invalid demo account ID.");
        return appDb!.begin(async (transaction) => {
          await transaction.unsafe("SELECT set_config('app.current_user_id', $1, true)", [userId]);
          const rows = await transaction.unsafe(
            "SELECT id::text AS id FROM public.listings WHERE seller_user_id = $1::uuid",
            [userId],
          );
          return rows.map((row) => ({ id: String(row.id) }));
        });
      },
      deleteListingMedia: async (listingId: string): Promise<void> => {
        if (!UUID_PATTERN.test(listingId)) throw new Error("Invalid demo listing ID.");
        await removeStorageFolder("listings/" + listingId);
      },
      deleteUserMedia: async (account: ExpiredDemoAccount): Promise<void> => {
        // External avatar URLs are never treated as owned Storage paths.
        if (hasOwnedAvatar(account)) await removeStorageFolder("avatars/" + account.id);
      },
      deleteExpiredAccount: async (userId: string): Promise<boolean> => {
        const rows = await authDb!.unsafe(
          "SELECT private.delete_expired_demo_account($1::uuid) AS deleted",
          [userId],
        );
        return rows[0]?.deleted === true;
      },
    };

    const summary = await cleanupExpiredDemoAccounts(dependencies, ACCOUNT_BATCH_SIZE);
    console.info(
      "[demo cleanup] found=" + summary.found + " deleted=" + summary.deleted + " skipped=" + summary.skipped + " failed=" + summary.failed,
    );
    if (summary.failed > 0) {
      return Response.json({ error: "DEMO_CLEANUP_INCOMPLETE", ...summary }, { status: 500 });
    }
    return Response.json(summary, { status: 200 });
  } catch (error) {
    // Log the underlying exception for diagnosis, but keep internal details out
    // of the HTTP response returned by the scheduled function.
    console.error("[demo cleanup] scheduled cleanup failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "DEMO_CLEANUP_FAILED" }, { status: 500 });
  } finally {
    await Promise.all([
      Promise.resolve(authDb?.end({ timeout: 5 })),
      Promise.resolve(appDb?.end({ timeout: 5 })),
    ]);
  }
}
