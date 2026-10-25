import { and, eq } from "drizzle-orm";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings } from "@/db/schema";
import {
  isAllowedListingMediaFilename,
  uploadListingMediaCaptions,
} from "@/db/supabase/storage-admin";
import { captionFilenameForVideo, MAX_CAPTION_FILE_BYTES, validateWebVttCaptionFile } from "@/lib/media/captions";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string; filename: string }>;
};

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return errorResponse(
      "UNAUTHENTICATED",
      "You must be signed in to upload video captions.",
      401,
    );
  }

  const { id: listingId, filename } = await params;

  if (!UUID_PATTERN.test(listingId)) {
    return errorResponse("INVALID_LISTING_ID", "The listing ID is invalid.", 400);
  }

  if (
    !isAllowedListingMediaFilename(filename) ||
    !captionFilenameForVideo(filename)
  ) {
    return errorResponse(
      "INVALID_VIDEO_FILENAME",
      "Captions can only be attached to a registered video filename.",
      400,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      "INVALID_CAPTION_UPLOAD",
      "Provide a WebVTT caption file in the file field.",
      400,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(
      "INVALID_CAPTION_UPLOAD",
      "Provide a WebVTT caption file in the file field.",
      400,
    );
  }

  if (file.size > MAX_CAPTION_FILE_BYTES) {
    return errorResponse(
      "INVALID_CAPTION_FILE",
      `Caption files must be no larger than ${MAX_CAPTION_FILE_BYTES.toLocaleString()} bytes.`,
      400,
    );
  }

  const content = await file.text();
  const validationError = validateWebVttCaptionFile(file, content);
  if (validationError) {
    return errorResponse("INVALID_CAPTION_FILE", validationError, 400);
  }

  try {
    const listing = await withAppUserTransaction(userId, async (tx) => {
      const [row] = await tx
        .select({ id: listings.id, media: listings.media })
        .from(listings)
        .where(and(eq(listings.id, listingId), eq(listings.sellerUserId, userId)))
        .limit(1);

      return row ?? null;
    });

    if (!listing) {
      return errorResponse("LISTING_NOT_FOUND", "Listing not found.", 404);
    }

    if (!listing.media.includes(filename)) {
      return errorResponse(
        "MEDIA_NOT_FOUND",
        "The video is not registered on this listing.",
        404,
      );
    }

    const saved = await uploadListingMediaCaptions({
      listingId,
      videoFilename: filename,
      content,
      size: file.size,
    });

    return Response.json(
      {
        data: {
          listingId,
          videoFilename: filename,
          filename: saved.filename,
          uploaded: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST listing media captions failed:", error);
    return errorResponse(
      "CAPTION_UPLOAD_FAILED",
      "Unable to save the video captions.",
      500,
    );
  }
}
