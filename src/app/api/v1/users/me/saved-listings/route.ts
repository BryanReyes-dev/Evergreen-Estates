import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings, users } from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SAVED_LISTINGS = 100;
type SavedListingIdsResult = { savedListingIds: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
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
      if (!listing) return { kind: "listing-not-found" as const };

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

    if (result.kind === "listing-not-found") return errorResponse("LISTING_NOT_FOUND", "That listing is no longer available.", 404);
    if (result.kind === "user-not-found") return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);
    if (result.kind === "limit-reached") return errorResponse("SAVED_LISTINGS_LIMIT_REACHED", "You can save up to 100 homes. Remove a saved home before adding another.", 409);
    return NextResponse.json({ data: { savedListingIds: result.savedListingIds } satisfies SavedListingIdsResult }, { status: 200 });
  } catch (error) {
    console.error("PATCH saved listings failed:", error);
    return errorResponse("SAVED_LISTINGS_UPDATE_FAILED", "Your saved homes could not be updated. Try again.", 500);
  }
}
