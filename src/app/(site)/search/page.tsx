import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { Suspense } from "react";

import { Filters } from "@/components/Filters";
import { LoadingState } from "@/components/ui/loading-state";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { users } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  normalizeAccountPreferences,
  type AccountPreferences,
} from "@/lib/account-preferences";

interface SearchParams {
  query?: string;
  price?: string;
  tag?: string | string[];
  sort?: string;
}

export const dynamic = "force-dynamic";

const Search = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const params = await searchParams;
  let preferences: AccountPreferences = DEFAULT_ACCOUNT_PREFERENCES;

  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const [account] = await withAppUserTransaction(session.user.id, async (tx) =>
        tx.select({ preferences: users.preferences })
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1),
      );
      if (account) preferences = normalizeAccountPreferences(account.preferences);
    }
  } catch (error) {
    // Anonymous browsing remains available if account preferences can't be read.
    console.error("Could not load saved browsing preferences.", error);
  }

  return (
    <div className="mx-auto w-full max-w-[1140px]">
      <Filters />
      <Suspense fallback={<LoadingState label="Loading homes…" size="lg" />}>
        <ResultsDisplay
          searchParams={params}
          defaultSort={preferences.defaultSort}
          viewMode={preferences.viewMode}
        />
      </Suspense>
    </div>
  );
};

export default Search;
