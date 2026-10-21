import { and, eq } from "drizzle-orm";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import {
  getListingMediaPreviews,
  isAllowedListingMediaFilename,
} from "@/db/supabase/storage-admin";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isExactPermutation(
  submitted: string[],
  registered: string[],
): boolean {
  if (submitted.length !== registered.length) {
    return false;
  }

  const registeredFilenames = new Set(registered);

  return (
    registeredFilenames.size === registered.length &&
    submitted.every((filename) => registeredFilenames.has(filename))
  );
}

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must be signed in to view listing media.",
        },
      },
      { status: 401 },
    );
  }

  const { id: listingId } = await params;

  if (!UUID_PATTERN.test(listingId)) {
    return Response.json(
      {
        error: {
          code: "INVALID_LISTING_ID",
          message: "The listing ID is invalid.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const listing = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [ownedListing] = await tx
          .select({
            id: listings.id,
            media: listings.media,
          })
          .from(listings)
          .where(
            and(
              eq(listings.id, listingId),
              eq(listings.sellerUserId, userId),
            ),
          )
          .limit(1);

        return ownedListing ?? null;
      },
    );

    if (!listing) {
      return Response.json(
        {
          error: {
            code: "LISTING_NOT_FOUND",
            message: "Listing not found.",
          },
        },
        { status: 404 },
      );
    }

    const media = await getListingMediaPreviews({
      listingId: listing.id,
      filenames: listing.media,
    });

    return Response.json(
      {
        data: {
          listingId: listing.id,
          media,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error(
      "GET /api/v1/listings/[id]/media failed:",
      error,
    );

    return Response.json(
      {
        error: {
          code: "MEDIA_LIST_FAILED",
          message: "Unable to retrieve listing media.",
        },
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must be signed in to reorder listing media.",
        },
      },
      { status: 401 },
    );
  }

  const { id: listingId } = await params;

  if (!UUID_PATTERN.test(listingId)) {
    return Response.json(
      {
        error: {
          code: "INVALID_LISTING_ID",
          message: "The listing ID is invalid.",
        },
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "The request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  if (
    !isRecord(body) ||
    Object.keys(body).some((key) => key !== "filenames") ||
    !Array.isArray(body.filenames) ||
    !body.filenames.every(
      (filename) =>
        typeof filename === "string" &&
        isAllowedListingMediaFilename(filename),
    )
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_MEDIA_ORDER",
          message: "Provide only a filenames array of valid media filenames.",
        },
      },
      { status: 400 },
    );
  }

  const filenames = body.filenames as string[];

  if (new Set(filenames).size !== filenames.length) {
    return Response.json(
      {
        error: {
          code: "INVALID_MEDIA_ORDER",
          message: "Media filenames must not contain duplicates.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [listing] = await tx
          .select({
            id: listings.id,
            media: listings.media,
          })
          .from(listings)
          .where(
            and(
              eq(listings.id, listingId),
              eq(listings.sellerUserId, userId),
            ),
          )
          .limit(1);

        if (!listing) {
          return { kind: "not_found" as const };
        }

        if (!isExactPermutation(filenames, listing.media)) {
          return { kind: "conflict" as const };
        }

        // Compare against the array read above so an upload or deletion
        // committed in the meantime cannot be silently overwritten.
        const [updated] = await tx
          .update(listings)
          .set({
            media: filenames,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(listings.id, listingId),
              eq(listings.sellerUserId, userId),
              eq(listings.media, listing.media),
            ),
          )
          .returning({
            id: listings.id,
            media: listings.media,
          });

        if (!updated) {
          return { kind: "conflict" as const };
        }

        return {
          kind: "updated" as const,
          media: updated.media,
        };
      },
    );

    if (result.kind === "not_found") {
      return Response.json(
        {
          error: {
            code: "LISTING_NOT_FOUND",
            message: "Listing not found.",
          },
        },
        { status: 404 },
      );
    }

    if (result.kind === "conflict") {
      return Response.json(
        {
          error: {
            code: "MEDIA_ORDER_CONFLICT",
            message: "The registered media changed. Refresh and try again.",
          },
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        data: {
          listingId,
          filenames: result.media,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /api/v1/listings/[id]/media failed:", error);

    return Response.json(
      {
        error: {
          code: "MEDIA_REORDER_FAILED",
          message: "Unable to reorder listing media.",
        },
      },
      { status: 500 },
    );
  }
}
