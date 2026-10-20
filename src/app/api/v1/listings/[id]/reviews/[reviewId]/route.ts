import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { reviews } from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{
    id: string;
    reviewId: string;
  }>;
};

// UPDATE: Only the author of a review can edit it.
export async function PATCH(
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

  const { id, reviewId } = await params;

  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(reviewId)) {
    return NextResponse.json(
      { error: "INVALID_ID" },
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

  const unsupportedFields = Object.keys(input).filter(
    (field) => !["rating", "comment"].includes(field),
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

  const updates: Partial<typeof reviews.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if ("rating" in input) {
    const ratingInput = input.rating;

    if (
      typeof ratingInput !== "number" ||
      !Number.isInteger(ratingInput) ||
      ratingInput < 1 ||
      ratingInput > 5
    ) {
      return NextResponse.json(
        { error: "INVALID_RATING" },
        { status: 400 },
      );
    }

    updates.rating = ratingInput;
  }

  if ("comment" in input) {
    const commentInput = input.comment;

    if (
      typeof commentInput !== "string" ||
      commentInput.trim().length === 0 ||
      commentInput.trim().length > 5000
    ) {
      return NextResponse.json(
        { error: "INVALID_COMMENT" },
        { status: 400 },
      );
    }

    updates.comment = commentInput.trim();
  }

  try {
    const updatedReview = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [review] = await tx
          .update(reviews)
          .set(updates)
          .where(
            and(
              eq(reviews.id, reviewId),
              eq(reviews.listingId, id),
              eq(reviews.userId, userId),
            ),
          )
          .returning({
            id: reviews.id,
            listingId: reviews.listingId,
            userId: reviews.userId,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            updatedAt: reviews.updatedAt,
          });

        return review ?? null;
      },
    );

    if (!updatedReview) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        data: {
          id: updatedReview.id,
          listing_id: updatedReview.listingId,
          user_id: updatedReview.userId,
          rating: updatedReview.rating,
          comment: updatedReview.comment,
          created_at: updatedReview.createdAt,
          updated_at: updatedReview.updatedAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH listing review failed:", error);

    return NextResponse.json(
      { error: "REVIEW_UPDATE_FAILED" },
      { status: 500 },
    );
  }
}

// DELETE: Only the author of a review can delete it.
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

  const { id, reviewId } = await params;

  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(reviewId)) {
    return NextResponse.json(
      { error: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    const deletedReview = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [review] = await tx
          .delete(reviews)
          .where(
            and(
              eq(reviews.id, reviewId),
              eq(reviews.listingId, id),
              eq(reviews.userId, userId),
            ),
          )
          .returning({ id: reviews.id });

        return review ?? null;
      },
    );

    if (!deletedReview) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND" },
        { status: 404 },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE listing review failed:", error);

    return NextResponse.json(
      { error: "REVIEW_DELETE_FAILED" },
      { status: 500 },
    );
  }
}