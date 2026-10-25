import { and, eq } from "drizzle-orm";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";
import {
  createListingMediaUpload,
  type SupportedMediaContentType,
} from "@/db/supabase/storage-admin";
import { MAX_MEDIA_FILE_BYTES } from "@/lib/media/file-limits";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024;

const ALLOWED_MEDIA_TYPES = new Set<SupportedMediaContentType>([
  "image/avif",
  "image/jpeg",
  "image/gif",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

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
          message: "You must be signed in to upload listing media.",
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

  if (!isRecord(body)) {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "Provide a contentType and file size.",
        },
      },
      { status: 400 },
    );
  }

  const { contentType, size } = body;

  if (
    typeof contentType !== "string" ||
    !ALLOWED_MEDIA_TYPES.has(
      contentType as SupportedMediaContentType,
    )
  ) {
    return Response.json(
      {
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "This image or video format is not supported.",
        },
      },
      { status: 415 },
    );
  }

  if (
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size <= 0
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_MEDIA_SIZE",
          message: "Provide a valid, positive file size in bytes.",
        },
      },
      { status: 400 },
    );
  }

  const mediaContentType = contentType as SupportedMediaContentType;
  const mediaKind = mediaContentType.startsWith("image/")
    ? "image"
    : "video";

  const maxBytes = MAX_MEDIA_FILE_BYTES;

  if (size > maxBytes) {
    return Response.json(
      {
        error: {
          code: "MEDIA_TOO_LARGE",
          message: `This ${mediaKind} exceeds the allowed file size.`,
          maxBytes,
        },
      },
      { status: 413 },
    );
  }

  try {
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

    const upload = await createListingMediaUpload({
      listingId,
      contentType: mediaContentType,
    });

    return Response.json(
      {
        data: {
          bucket: "property-images",
          path: upload.path,
          token: upload.token,
          contentType: upload.contentType,
          mediaKind: upload.mediaKind,
          maxBytes,
          uploadMethod: size > RESUMABLE_THRESHOLD_BYTES
            ? "tus"
            : "standard",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/v1/listings/[id]/media/upload-url failed:",
      error,
    );

    return Response.json(
      {
        error: {
          code: "UPLOAD_URL_CREATE_FAILED",
          message: "Unable to prepare the media upload.",
        },
      },
      { status: 500 },
    );
  }
}