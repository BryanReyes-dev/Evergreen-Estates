import { and, arrayContains, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { deleteListingMediaObjects } from "@/db/supabase/storage-admin";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MEDIA_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/i;

type RouteContext = {
  params: Promise<{
    id: string;
    filename: string;
  }>;
};

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { id, filename } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "INVALID_LISTING_ID" },
      { status: 400 },
    );
  }

  if (!MEDIA_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json(
      { error: "INVALID_MEDIA_FILENAME" },
      { status: 400 },
    );
  }

  try {
    // Confirm that this listing belongs to the authenticated user
    // and that the requested file is registered on that listing.
    const listing = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [row] = await tx
          .select({
            id: listings.id,
            media: listings.media,
          })
          .from(listings)
          .where(
            and(
              eq(listings.id, id),
              eq(listings.sellerUserId, userId),
            ),
          )
          .limit(1);

        return row ?? null;
      },
    );

    if (!listing) {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (!listing.media.includes(filename)) {
      return NextResponse.json(
        { error: "MEDIA_NOT_FOUND" },
        { status: 404 },
      );
    }

    // Remove the actual file from private Supabase Storage first.
    // If removal fails, the database registration remains unchanged.
    await deleteListingMediaObjects({
      listingId: listing.id,
      filenames: [filename],
    });

    // Then remove its filename from the listing's media array.
    const updated = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [row] = await tx
          .update(listings)
          .set({
            media: sql`array_remove(${listings.media}, ${filename})`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(listings.id, id),
              eq(listings.sellerUserId, userId),
              arrayContains(listings.media, [filename]),
            ),
          )
          .returning({ id: listings.id });

        return row ?? null;
      },
    );

    if (!updated) {
      return NextResponse.json(
        {
          error: "MEDIA_REGISTRATION_UPDATE_FAILED",
          message:
            "The Storage file was removed, but the listing's media record could not be updated. Retry the deletion to finish cleanup.",
        },
        { status: 500 },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE listing media failed:", error);

    return NextResponse.json(
      { error: "MEDIA_DELETE_FAILED" },
      { status: 500 },
    );
  }
}