import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { getDrizzleDb } from "@/db/drizzle/client";
import { listings, users } from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SAVED_LISTINGS = 100;
type SavedListingIdsResult = { savedListingIds: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function errorResponse(code: string, message: string, status: number, diagnostics?: object) {
  return NextResponse.json(
    {
      error: { code, message },
      ...(diagnostics ? { diagnostics } : {}),
    },
    { status },
  );
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return errorResponse("UNAUTHENTICATED", "Sign in to view saved homes.", 401);
  try {
    const user = await withAppUserTransaction(userId, async (tx) => {
      const [row] = await tx.select({ savedListingIds: users.savedListings })
        .from(users).where(eq(users.id, userId)).limit(1);
      return row ?? null;
    });
    if (!user) return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);
    return NextResponse.json({ data: { savedListingIds: user.savedListingIds } satisfies SavedListingIdsResult }, { status: 200 });
  } catch (error) {
    console.error("GET saved listings failed:", error);
    return errorResponse("SAVED_LISTINGS_READ_FAILED", "Your saved homes could not be loaded. Try again.", 500);
  }
}

/** Body: { listingId: string, saved: boolean }. The owner ID and complete array are never accepted. */
export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return errorResponse("UNAUTHENTICATED", "Sign in to save homes.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "The request body must be valid JSON.", 400);
  }
  if (!isRecord(body)) return errorResponse("INVALID_REQUEST_BODY", "Provide a listing ID and saved state.", 400);
  if (Object.keys(body).some((key) => key !== "listingId" && key !== "saved")) {
    return errorResponse("UNSUPPORTED_FIELD", "Only listingId and saved are supported.", 400);
  }
  if (typeof body.listingId !== "string" || !UUID_PATTERN.test(body.listingId)) {
    return errorResponse("INVALID_LISTING_ID", "Provide a valid listing ID.", 400);
  }
  if (typeof body.saved !== "boolean") {
    return errorResponse("INVALID_SAVED_STATE", "The saved field must be true or false.", 400);
  }

  const listingId = body.listingId.toLowerCase();
  const shouldSave = body.saved;
  try {
    const result = await withAppUserTransaction(userId, async (tx) => {
      const [listing] = await tx.select({ id: listings.id }).from(listings)
        .where(eq(listings.id, listingId)).limit(1).for("key share");
      if (!listing) {
        // Capture the effective context of the *same* transaction/connection.
        // This distinguishes RLS/role issues from different DB/schema resolution.
        type DatabaseContext = {
          databaseName: string;
          currentRole: string;
          sessionRole: string;
          currentSchema: string | null;
          searchPath: string;
          resolvedListingsTable: string | null;
          publicListingsTable: string | null;
          canSelectPublicListings: boolean;
          canUseReadRole: boolean;
          visiblePublicListingCount: number;
          visibleResolvedListingCount: number;
        };

        let databaseContext: DatabaseContext | null = null;
        try {
          const [context] = await tx.select({
            databaseName: sql<string>`current_database()`,
            currentRole: sql<string>`current_user`,
            sessionRole: sql<string>`session_user`,
            currentSchema: sql<string | null>`current_schema()`,
            searchPath: sql<string>`current_setting('search_path')`,
            resolvedListingsTable: sql<string | null>`to_regclass('listings')::text`,
            publicListingsTable: sql<string | null>`to_regclass('public.listings')::text`,
            canSelectPublicListings: sql<boolean>`has_table_privilege(current_user, 'public.listings', 'SELECT')`,
            canUseReadRole: sql<boolean>`pg_has_role(current_user, 'evergreen_read', 'USAGE')`,
            visiblePublicListingCount: sql<number>`(select count(*)::int from public.listings)`,
            visibleResolvedListingCount: sql<number>`(select count(*)::int from listings)`,
          }).limit(1);
          databaseContext = context ?? null;
        } catch (diagnosticError) {
          console.error("Could not capture saved-home database context.", diagnosticError);
        }

        return { kind: "listing-not-found" as const, databaseContext };
      }

      const nextSavedListings = shouldSave
        ? sql`CASE
            WHEN ${users.savedListings} @> ARRAY[${listingId}::uuid] THEN ${users.savedListings}
            WHEN cardinality(${users.savedListings}) >= ${MAX_SAVED_LISTINGS} THEN ${users.savedListings}
            ELSE array_append(${users.savedListings}, ${listingId}::uuid)
          END`
        : sql`array_remove(${users.savedListings}, ${listingId}::uuid)`;

      const [updatedUser] = await tx.update(users).set({ savedListings: nextSavedListings })
        .where(eq(users.id, userId)).returning({ savedListingIds: users.savedListings });
      if (!updatedUser) return { kind: "user-not-found" as const };
      if (shouldSave && !updatedUser.savedListingIds.includes(listingId)) {
        return { kind: "limit-reached" as const };
      }
      return { kind: "updated" as const, savedListingIds: updatedUser.savedListingIds };
    });

    if (result.kind === "listing-not-found") {
      // Cross-check with the public read connection so a database/role mismatch
      // is not reported as if the property's record had been deleted.
      try {
        const [visibleListing] = await getDrizzleDb()
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.id, listingId))
          .limit(1);

        if (visibleListing) {
          console.error("Saved-home listing lookup mismatch between app and read connections.", {
            listingId,
            databaseContext: result.databaseContext,
          });
          return errorResponse(
            "LISTING_LOOKUP_MISMATCH",
            "This property is visible in the listing catalog, but the save service cannot find it. Check the diagnostics returned with this error.",
            503,
            result.databaseContext ?? undefined,
          );
        }
      } catch (diagnosticError) {
        // Preserve the original not-found response if the diagnostic read fails.
        console.error("Could not cross-check the missing saved-home listing.", diagnosticError);
      }

      return errorResponse("LISTING_NOT_FOUND", "That listing is no longer available.", 404);
    }
    if (result.kind === "user-not-found") return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);
    if (result.kind === "limit-reached") return errorResponse("SAVED_LISTINGS_LIMIT_REACHED", "You can save up to 100 homes. Remove a saved home before adding another.", 409);
    return NextResponse.json({ data: { savedListingIds: result.savedListingIds } satisfies SavedListingIdsResult }, { status: 200 });
  } catch (error) {
    console.error("PATCH saved listings failed:", error);
    return errorResponse("SAVED_LISTINGS_UPDATE_FAILED", "Your saved homes could not be updated. Try again.", 500);
  }
}
