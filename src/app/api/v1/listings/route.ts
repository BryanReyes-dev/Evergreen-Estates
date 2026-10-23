import { getFilteredListings } from "@/db/queries/listings";
import type { filters as ListingFilters } from "@/app/types";
import { eq } from "drizzle-orm";
import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings, sellerProfiles } from "@/db/schema";
import { MAX_LISTING_PRICE, MIN_LISTING_PRICE, SUPPORTED_LISTING_TAG_VALUES } from "@/lib/listing-constants";
import getMediaUrls from "@/db/supabase/util/GetMediaUrls";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";


type CreateListingInput = {
  title: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  tags: string[];
};

const CREATE_LISTING_FIELDS = new Set([
  "title",
  "price",
  "beds",
  "baths",
  "sqft",
  "address",
  "description",
  "tags",
]);

// Utility function to check if a value is a record (object) with string keys and unknown values.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Parses and validates the input for creating a listing. Returns a CreateListingInput object if valid, or null if invalid.
function parseCreateListingInput(
  value: unknown,
): CreateListingInput | null {
  if (!isRecord(value)) return null;

  // Reject ownership, ID, timestamp, and other unexpected fields.
  if (Object.keys(value).some((key) => !CREATE_LISTING_FIELDS.has(key))) {
    return null;
  }

  const {
    title,
    price,
    beds,
    baths,
    sqft,
    address,
    description,
    tags,
  } = value;

  if (
    typeof title !== "string" ||
    title.trim().length === 0 ||
    title.trim().length > 160 ||
    typeof address !== "string" ||
    address.trim().length === 0 ||
    address.trim().length > 300 ||
    typeof description !== "string" ||
    description.trim().length === 0 ||
    description.length > 10_000 ||
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < MIN_LISTING_PRICE ||
    price > MAX_LISTING_PRICE ||
    !Number.isSafeInteger(beds) ||
    (beds as number) < 0 ||
    !Number.isSafeInteger(baths) ||
    (baths as number) < 0 ||
    !Number.isSafeInteger(sqft) ||
    (sqft as number) < 1
  ) {
    return null;
  }

  const normalizedTags = tags ?? [];

  if (
    !Array.isArray(normalizedTags) ||
    normalizedTags.length > SUPPORTED_LISTING_TAG_VALUES.length ||
    !normalizedTags.every(
      (tag) =>
        typeof tag === "string" &&
        tag.trim().length > 0 &&
        tag.trim().length <= 40 &&
        SUPPORTED_LISTING_TAG_VALUES.includes(tag.trim().toLowerCase()),
    )
  ) {
    return null;
  }

  return {
    title: title.trim(),
    price,
    beds: beds as number,
    baths: baths as number,
    sqft: sqft as number,
    address: address.trim(),
    description: description.trim(),
    tags: normalizedTags.map((tag) => (tag as string).trim().toLowerCase()),
  };
}

// Checks if the provided error is a listing cap violation error, indicating that a seller has reached the maximum number of listings allowed.
function isListingCapViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const databaseError = error as {
    code?: unknown;
    constraint?: unknown;
  };

  return (
    databaseError.code === "23514" &&
    databaseError.constraint === "listings_max_three_per_seller"
  );
}


//get all listings with optional filters
export async function GET(request: Request) {

    const { searchParams } = new URL(request.url);

    let price: ListingFilters["price"] = null;

    const rawPrice = searchParams.get("price");

    if (rawPrice !== null) {
    const parts = rawPrice.split("-");

    if (parts.length !== 2 || parts.some((part) => part.trim() === "")) {
        return Response.json(
        {
            error: {
            code: "INVALID_PRICE_RANGE",
            message: "Use price=min-max.",
            },
        },
        { status: 400 },
        );
    }

    const [minPrice, maxPrice] = parts.map(Number);

    if (
        !Number.isFinite(minPrice) ||
        !Number.isFinite(maxPrice) ||
        minPrice < MIN_LISTING_PRICE ||
        maxPrice > MAX_LISTING_PRICE ||
        maxPrice < minPrice
    ) {
        return Response.json(
        {
            error: {
            code: "INVALID_PRICE_RANGE",
            message: "Choose a price range between $10,000 and $10,000,000.",
            },
        },
        { status: 400 },
        );
    }

    price = [minPrice, maxPrice];
    }

    
    const search = searchParams.get("query")?.trim() || null;

    const tags = searchParams
        .getAll("tag")
        .map((tag) => tag.trim())
        .filter(Boolean);

  try {
    const listings = await getFilteredListings({
      price: price,
      tags: tags.length > 0 ? tags : null,
      search: search,
    });

    return Response.json({ data: listings }, { status: 200 });
  } catch (error) {
    console.error("GET /api/v1/listings failed:", error);

    return Response.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve listings.",
        },
      },
      { status: 500 },
    );
  }
}

// Utility type guard to check if a value is a record (object) with string keys and unknown values.
function isRequestRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

//check if the error is a listing limit error (max 3 listings per seller)
function isListingLimitError(error: unknown): boolean {
  if (!isRequestRecord(error)) {
    return false;
  }

  return (
    error.code === "23514" &&
    error.constraint === "listings_max_three_per_seller"
  );
}

// POST /api/v1/listings
export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in before creating a listing.",
        },
      },
      { status: 401 },
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

  if (!isRequestRecord(body)) {
    return Response.json(
      {
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "Provide listing details.",
        },
      },
      { status: 400 },
    );
  }

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

  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return Response.json(
      {
        error: {
          code: "UNSUPPORTED_FIELD",
          message:
            "Do not supply listing IDs, owner IDs, or media fields.",
        },
      },
      { status: 400 },
    );
  }

  const {
    title,
    price,
    beds,
    baths,
    sqft,
    address,
    description,
    tags: rawTags,
  } = body;

  if (
    typeof title !== "string" ||
    title.trim().length < 3 ||
    title.trim().length > 140
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_TITLE",
          message: "Title must be between 3 and 140 characters.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < MIN_LISTING_PRICE ||
    price > MAX_LISTING_PRICE
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_PRICE",
          message: "Listing price must be between $10,000 and $10,000,000.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof beds !== "number" ||
    !Number.isSafeInteger(beds) ||
    beds < 0 ||
    beds > 100
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_BEDS",
          message: "Beds must be a whole number between 0 and 100.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof baths !== "number" ||
    !Number.isSafeInteger(baths) ||
    baths < 0 ||
    baths > 100
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_BATHS",
          message: "Baths must be a whole number between 0 and 100.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof sqft !== "number" ||
    !Number.isSafeInteger(sqft) ||
    sqft < 1 ||
    sqft > 1_000_000
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_SQFT",
          message: "Square footage must be between 1 and 1,000,000.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof address !== "string" ||
    address.trim().length < 5 ||
    address.trim().length > 300
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_ADDRESS",
          message: "Address must be between 5 and 300 characters.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof description !== "string" ||
    description.trim().length < 1 ||
    description.length > 5000
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_DESCRIPTION",
          message: "Description must contain 1–5000 characters.",
        },
      },
      { status: 400 },
    );
  }

  if (
    rawTags !== undefined &&
    (
      !Array.isArray(rawTags) ||
      rawTags.length > 20 ||
      !rawTags.every(
        (tag) =>
          typeof tag === "string" &&
          tag.trim().length >= 1 &&
          tag.trim().length <= 40 &&
          SUPPORTED_LISTING_TAG_VALUES.includes(tag.trim().toLowerCase()),
      )
    )
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_TAGS",
          message: "Choose only supported property tags.",
        },
      },
      { status: 400 },
    );
  }

  const tags = [
    ...new Map(
      ((rawTags ?? []) as string[])
        .map((tag) => tag.trim())
        .map((tag) => [tag.toLowerCase(), tag.toLowerCase()] as const),
    ).values(),
  ];

  try {
    const result = await withAppUserTransaction(
      userId,
      async (tx) => {
        // Seller eligibility must be established before listing creation.
        const [profile] = await tx
          .select({ userId: sellerProfiles.userId, isPublished: sellerProfiles.isPublished })
          .from(sellerProfiles)
          .where(eq(sellerProfiles.userId, userId))
          .for("update")
          .limit(1);

        if (!profile) {
          return { kind: "seller-profile-required" as const };
        }
        if (!profile.isPublished) {
          return { kind: "seller-profile-private" as const };
        }

        const [created] = await tx
          .insert(listings)
          .values({
            // Ownership always comes from the verified session.
            sellerUserId: userId,

            title: title.trim(),
            price: String(price),
            beds,
            baths,
            sqft,
            address: address.trim(),
            description: description.trim(),
            tags,

            // Media must be uploaded and registered separately.
            media: [],
          })
          .returning({
            id: listings.id,
            media: listings.media,
            tags: listings.tags,
            title: listings.title,
            price: listings.price,
            beds: listings.beds,
            baths: listings.baths,
            sqft: listings.sqft,
            address: listings.address,
            description: listings.description,
            createdAt: listings.createdAt,
          });

        if (!created) {
          throw new Error("Listing insert returned no row.");
        }

        return { kind: "created" as const, listing: created };
      },
    );

    if (result.kind === "seller-profile-required") {
      return Response.json(
        {
          error: {
            code: "SELLER_PROFILE_REQUIRED",
            message: "Create a seller profile before creating listings.",
          },
        },
        { status: 409 },
      );
    }

    if (result.kind === "seller-profile-private") {
      return Response.json(
        {
          error: {
            code: "SELLER_PROFILE_NOT_PUBLIC",
            message: "Publish your seller profile before creating a listing.",
          },
        },
        { status: 409 },
      );
    }

    const listing = result.listing;

    return Response.json(
      {
        data: {
          id: listing.id,
          media: listing.media,
          tags: listing.tags,
          title: listing.title,
          price: Number(listing.price),
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          address: listing.address,
          description: listing.description,
          created_at: listing.createdAt,
          reviews: [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isListingLimitError(error)) {
      return Response.json(
        {
          error: {
            code: "LISTING_LIMIT_REACHED",
            message: "A seller can own at most three listings.",
          },
        },
        { status: 409 },
      );
    }

    console.error("POST /api/v1/listings failed:", error);

    return Response.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create listing.",
        },
      },
      { status: 500 },
    );
  }
}
