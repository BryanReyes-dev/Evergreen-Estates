import { getListingById } from "@/db/queries/listings"
import { and, eq } from "drizzle-orm";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { deleteListingMediaObjects } from "@/db/supabase/storage-admin";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";


// GET /api/v1/listings/:id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const listing = await getListingById(id);

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

    return Response.json({ data: listing }, { status: 200 });
  } catch (error) {
    console.error(`GET /api/v1/listings/${id} failed:`, error);

    return Response.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve listing.",
        },
      },
      { status: 500 },
    );
  }
}

// PATCH /api/v1/listings/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const isValidUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );

  if (!isValidUuid) {
    return NextResponse.json(
      { error: "INVALID_LISTING_ID" },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON" },
      { status: 400 },
    );
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "INVALID_REQUEST_BODY" },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;

  const allowedFields = new Set([
    "title",
    "price",
    "beds",
    "baths",
    "sqft",
    "address",
    "description",
    "tags",
  ]);

  const unsupportedFields = Object.keys(input).filter(
    (field) => !allowedFields.has(field),
  );

  if (unsupportedFields.length > 0) {
    return NextResponse.json(
      {
        error: "UNSUPPORTED_FIELDS",
        fields: unsupportedFields,
      },
      { status: 400 },
    );
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json(
      { error: "EMPTY_UPDATE" },
      { status: 400 },
    );
  }

  const updates: Partial<typeof listings.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if ("title" in input) {
    if (
      typeof input.title !== "string" ||
      input.title.trim().length === 0 ||
      input.title.trim().length > 200
    ) {
      return NextResponse.json(
        { error: "INVALID_TITLE" },
        { status: 400 },
      );
    }

    updates.title = input.title.trim();
  }

  if ("price" in input) {
    const rawPrice = input.price;

    const priceString =
      typeof rawPrice === "number"
        ? String(rawPrice)
        : typeof rawPrice === "string"
          ? rawPrice.trim()
          : "";

    if (!/^\d+(\.\d+)?$/.test(priceString)) {
      return NextResponse.json(
        { error: "INVALID_PRICE" },
        { status: 400 },
      );
    }

    const price = Number(priceString);

    if (!Number.isFinite(price)) {
      return NextResponse.json(
        { error: "INVALID_PRICE" },
        { status: 400 },
      );
    }

    updates.price = priceString;
  }

  for (const field of ["beds", "baths", "sqft"] as const) {
    if (!(field in input)) continue;

    const value = input[field];

    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      return NextResponse.json(
        { error: `INVALID_${field.toUpperCase()}` },
        { status: 400 },
      );
    }

    updates[field] = value;
  }

  if ("address" in input) {
    if (
      typeof input.address !== "string" ||
      input.address.trim().length === 0 ||
      input.address.trim().length > 1000
    ) {
      return NextResponse.json(
        { error: "INVALID_ADDRESS" },
        { status: 400 },
      );
    }

    updates.address = input.address.trim();
  }

  if ("description" in input) {
    if (
      typeof input.description !== "string" ||
      input.description.length > 20_000
    ) {
      return NextResponse.json(
        { error: "INVALID_DESCRIPTION" },
        { status: 400 },
      );
    }

    updates.description = input.description;
  }

  if ("tags" in input) {
    if (
      !Array.isArray(input.tags) ||
      input.tags.length > 50 ||
      !input.tags.every(
        (tag) =>
          typeof tag === "string" &&
          tag.trim().length > 0 &&
          tag.trim().length <= 100,
      )
    ) {
      return NextResponse.json(
        { error: "INVALID_TAGS" },
        { status: 400 },
      );
    }

    updates.tags = [
      ...new Map(
        input.tags.map((tag) => {
          const normalized = tag.trim();
          return [normalized.toLowerCase(), normalized] as const;
        }),
      ).values(),
    ];
  }

  try {
    const updatedListing = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [updated] = await tx
          .update(listings)
          .set(updates)
          .where(
            and(
              eq(listings.id, id),
              eq(listings.sellerUserId, userId),
            ),
          )
          .returning({ id: listings.id });

        return updated ?? null;
      },
    );

    if (!updatedListing) {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND" },
        { status: 404 },
      );
    }

    const listing = await getListingById(id);

    if (!listing) {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: listing },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /api/v1/listings/[id] failed:", error);

    return NextResponse.json(
      { error: "LISTING_UPDATE_FAILED" },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/listings/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const isValidUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );

  if (!isValidUuid) {
    return NextResponse.json(
      { error: "INVALID_LISTING_ID" },
      { status: 400 },
    );
  }

  let mediaCleanupCompleted = false;

  try {
    // First, retrieve the listing only if the signed-in user owns it.
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
              eq(listings.id, id),
              eq(listings.sellerUserId, userId),
            ),
          )
          .limit(1);

        return ownedListing ?? null;
      },
    );

    if (!listing) {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND" },
        { status: 404 },
      );
    }

    // Remove this listing's registered files from Supabase Storage.
    // If this fails, the database listing is left in place.
    await deleteListingMediaObjects({
      listingId: listing.id,
      filenames: listing.media ?? [],
    });

    mediaCleanupCompleted = true;

    // Only delete the database row after media cleanup succeeds.
    const deletedListing = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [deleted] = await tx
          .delete(listings)
          .where(
            and(
              eq(listings.id, id),
              eq(listings.sellerUserId, userId),
            ),
          )
          .returning({ id: listings.id });

        return deleted ?? null;
      },
    );

    if (!deletedListing) {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND" },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete listing:", error);

    return NextResponse.json(
      {
        error: "LISTING_DELETE_FAILED",
        message: mediaCleanupCompleted
          ? "Media cleanup succeeded, but the listing record could not be deleted. Retry deletion."
          : "The listing was not deleted because media cleanup failed. Retry deletion.",
      },
      { status: 500 },
    );
  }
}