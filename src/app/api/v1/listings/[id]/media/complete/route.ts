import { and, eq, sql } from "drizzle-orm";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";
import { inspectListingMediaObject } from "@/db/supabase/storage-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MEDIA_PATH_PATTERN =
  /^listings\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/i;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 45_000_000;

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

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "You must be signed in to complete a media upload.",
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
    typeof body.path !== "string" ||
    !MEDIA_PATH_PATTERN.test(body.path) ||
    !body.path.startsWith(`listings/${listingId}/`)
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_MEDIA_PATH",
          message: "Provide a valid media path for this listing.",
        },
      },
      { status: 400 },
    );
  }

  const path = body.path;

  try {
    // Verify ownership before inspecting Storage.
    const ownsListing = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [listing] = await tx
          .select({ id: listings.id })
          .from(listings)
          .where(
            and(
              eq(listings.id, listingId),
              eq(listings.sellerUserId, userId),
            ),
          )
          .limit(1);

        return Boolean(listing);
      },
    );

    if (!ownsListing) {
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

    // Inspect the object outside a database transaction.
    const object = await inspectListingMediaObject({
      listingId,
      path,
    });

    if (!object) {
      return Response.json(
        {
          error: {
            code: "MEDIA_UPLOAD_INCOMPLETE",
            message: "The uploaded media object was not found.",
          },
        },
        { status: 409 },
      );
    }

    const maxBytes = object.mediaKind === "image"
      ? MAX_IMAGE_BYTES
      : MAX_VIDEO_BYTES;

    if (object.size > maxBytes) {
      return Response.json(
        {
          error: {
            code: "MEDIA_TOO_LARGE",
            message: "The stored media exceeds the allowed file size.",
            maxBytes,
          },
        },
        { status: 413 },
      );
    }

    if (object.contentType !== object.expectedContentType) {
      return Response.json(
        {
          error: {
            code: "MEDIA_TYPE_MISMATCH",
            message: "The stored content type does not match its file extension.",
          },
        },
        { status: 415 },
      );
    }

    // Store the filename, not the full Storage path.
    // This matches the format expected by the existing media queries.
    const registration = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [listing] = await tx
          .select({ media: listings.media })
          .from(listings)
          .where(
            and(
              eq(listings.id, listingId),
              eq(listings.sellerUserId, userId),
            ),
          )
          .limit(1);

        if (!listing) {
          return null;
        }

        const alreadyRegistered =
          listing.media.includes(object.filename);

        if (alreadyRegistered) {
          return { alreadyRegistered: true };
        }

        // Append atomically so concurrent completions do not overwrite
        // one another's media filenames.
        const [updated] = await tx
          .update(listings)
          .set({
            media: sql<string[]>`
              CASE
                WHEN array_position(${listings.media}, ${object.filename}) IS NULL
                THEN array_append(${listings.media}, ${object.filename})
                ELSE ${listings.media}
              END
            `,
          })
          .where(
            and(
              eq(listings.id, listingId),
              eq(listings.sellerUserId, userId),
            ),
          )
          .returning({ id: listings.id });

        if (!updated) {
          return null;
        }

        return { alreadyRegistered: false };
      },
    );

    if (!registration) {
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

    return Response.json(
      {
        data: {
          listingId,
          filename: object.filename,
          mediaKind: object.mediaKind,
          size: object.size,
          registered: true,
          alreadyRegistered: registration.alreadyRegistered,
        },
      },
      { status: registration.alreadyRegistered ? 200 : 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/v1/listings/[id]/media/complete failed:",
      error,
    );

    return Response.json(
      {
        error: {
          code: "MEDIA_COMPLETION_FAILED",
          message: "Unable to verify and register the uploaded media.",
        },
      },
      { status: 500 },
    );
  }
}