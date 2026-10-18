import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getDrizzleDb } from "@/db/drizzle/client";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings, reviews, users } from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

// READ: Retrieve public reviews for a listing.
export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "INVALID_LISTING_ID" },
      { status: 400 },
    );
  }

  try {
    const db = getDrizzleDb();

    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);

    if (!listing) {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND" },
        { status: 404 },
      );
    }

    const rows = await db
      .select({
        id: reviews.id,
        listingId: reviews.listingId,
        userId: reviews.userId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        authorId: users.id,
        authorName: users.name,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.listingId, id));

    const data = rows.map((review) => ({
      id: review.id,
      listing_id: review.listingId,
      user_id: review.userId,
      rating: review.rating,
      comment: review.comment,
      created_at: review.createdAt,
      user: {
        id: review.authorId ?? review.userId,
        name: review.authorName ?? "Unknown user",
      },
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("GET listing reviews failed:", error);

    return NextResponse.json(
      { error: "REVIEW_READ_FAILED" },
      { status: 500 },
    );
  }
}

// CREATE: An authenticated user can leave one review per listing.
export async function POST(
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

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
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

  // Validate rating and preserve its narrowed type.
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

  const rating = ratingInput;

  // Validate comment and preserve its narrowed type.
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

  const comment = commentInput.trim();

  try {
    const result = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [listing] = await tx
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.id, id))
          .limit(1);

        if (!listing) {
          return { status: "listing-not-found" as const };
        }

        const [review] = await tx
          .insert(reviews)
          .values({
            listingId: id,
            userId,
            rating,
            comment,
          })
          .onConflictDoNothing({
            target: [reviews.listingId, reviews.userId],
          })
          .returning({
            id: reviews.id,
            listingId: reviews.listingId,
            userId: reviews.userId,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
          });

        if (!review) {
          return { status: "duplicate" as const };
        }

        return {
          status: "created" as const,
          review,
        };
      },
    );

    if (result.status === "listing-not-found") {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (result.status === "duplicate") {
      return NextResponse.json(
        { error: "REVIEW_ALREADY_EXISTS" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        data: {
          id: result.review.id,
          listing_id: result.review.listingId,
          user_id: result.review.userId,
          rating: result.review.rating,
          comment: result.review.comment,
          created_at: result.review.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST listing review failed:", error);

    return NextResponse.json(
      { error: "REVIEW_CREATE_FAILED" },
      { status: 500 },
    );
  }
}