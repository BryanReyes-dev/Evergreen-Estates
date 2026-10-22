import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { listings, sellerProfiles } from "@/db/schema";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";


type ContactMethod = "email" | "phone";

// Utility type guard to check if a value is a record (object) with string keys and unknown values.
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Validates if a string is a valid email address using a simple regex pattern.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Validates if a string is a valid phone number using a regex pattern that allows for optional country codes, parentheses, dashes, and spaces.
function isValidPhone(value: string): boolean {
  return /^\+?[0-9().\-\s]{7,32}$/.test(value);
}

// Validates if a string is a valid HTTP or HTTPS URL.
function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// Helper function to create a standardized bad request response with a specific error code and message.
function badRequest(code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status: 400 },
  );
}

// POST /api/v1/seller-profiles
export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in before creating a seller profile.",
        },
      },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return badRequest(
      "INVALID_REQUEST_BODY",
      "The request body must be valid JSON.",
    );
  }

  if (!isRecord(body)) {
    return badRequest(
      "INVALID_REQUEST_BODY",
      "Provide seller profile details.",
    );
  }

  const allowedFields = new Set([
    "displayName",
    "bio",
    "avatarUrl",
    "contactEmail",
    "contactPhone",
    "preferredContactMethod",
  ]);

  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return badRequest(
      "UNSUPPORTED_FIELD",
      "The request contains an unsupported field.",
    );
  }

  const {
    displayName,
    bio,
    avatarUrl,
    contactEmail,
    contactPhone,
    preferredContactMethod,
  } = body;

  if (
    typeof displayName !== "string" ||
    displayName.trim().length < 1 ||
    displayName.trim().length > 100
  ) {
    return badRequest(
      "INVALID_DISPLAY_NAME",
      "Display name must be between 1 and 100 characters.",
    );
  }

  if (
    bio !== undefined &&
    bio !== null &&
    (typeof bio !== "string" || bio.length > 1000)
  ) {
    return badRequest(
      "INVALID_BIO",
      "Bio must be a string of at most 1000 characters.",
    );
  }

  if (
    avatarUrl !== undefined &&
    avatarUrl !== null &&
    (
      typeof avatarUrl !== "string" ||
      avatarUrl.length > 2048 ||
      !isValidHttpUrl(avatarUrl)
    )
  ) {
    return badRequest(
      "INVALID_AVATAR_URL",
      "Avatar URL must be a valid HTTP or HTTPS URL.",
    );
  }

  if (
    preferredContactMethod !== "email" &&
    preferredContactMethod !== "phone"
  ) {
    return badRequest(
      "INVALID_CONTACT_METHOD",
      "Preferred contact method must be email or phone.",
    );
  }

  const normalizedEmail =
    typeof contactEmail === "string"
      ? contactEmail.trim().toLowerCase()
      : "";

  const normalizedPhone =
    typeof contactPhone === "string"
      ? contactPhone.trim()
      : "";

  if (
    contactEmail !== undefined &&
    contactEmail !== null &&
    (
      typeof contactEmail !== "string" ||
      !isValidEmail(normalizedEmail)
    )
  ) {
    return badRequest(
      "INVALID_CONTACT_EMAIL",
      "Provide a valid contact email address.",
    );
  }

  if (
    contactPhone !== undefined &&
    contactPhone !== null &&
    (
      typeof contactPhone !== "string" ||
      !isValidPhone(normalizedPhone)
    )
  ) {
    return badRequest(
      "INVALID_CONTACT_PHONE",
      "Provide a valid contact phone number.",
    );
  }

  if (
    preferredContactMethod === "email" &&
    !normalizedEmail
  ) {
    return badRequest(
      "CONTACT_EMAIL_REQUIRED",
      "An email address is required for email contact.",
    );
  }

  if (
    preferredContactMethod === "phone" &&
    !normalizedPhone
  ) {
    return badRequest(
      "CONTACT_PHONE_REQUIRED",
      "A phone number is required for phone contact.",
    );
  }

  try {
    const profile = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [created] = await tx
          .insert(sellerProfiles)
          .values({
            userId,
            displayName: displayName.trim(),
            bio: typeof bio === "string" ? bio.trim() || null : null,
            avatarUrl:
              typeof avatarUrl === "string" ? avatarUrl.trim() || null : null,
            contactEmail: normalizedEmail || null,
            contactPhone: normalizedPhone || null,
            preferredContactMethod:
              preferredContactMethod as ContactMethod,
            // New sellers are not publicly listed until they opt in.
            isPublished: false,
          })
          .onConflictDoNothing({
            target: sellerProfiles.userId,
          })
          .returning({
            userId: sellerProfiles.userId,
            displayName: sellerProfiles.displayName,
            bio: sellerProfiles.bio,
            avatarUrl: sellerProfiles.avatarUrl,
            contactEmail: sellerProfiles.contactEmail,
            contactPhone: sellerProfiles.contactPhone,
            preferredContactMethod:
              sellerProfiles.preferredContactMethod,
            isPublished: sellerProfiles.isPublished,
          });

        return created ?? null;
      },
    );

    if (!profile) {
      return Response.json(
        {
          error: {
            code: "SELLER_PROFILE_EXISTS",
            message: "A seller profile already exists for this account.",
          },
        },
        { status: 409 },
      );
    }

    return Response.json(
      { data: profile },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/v1/seller-profiles failed:", error);

    return Response.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create seller profile.",
        },
      },
      { status: 500 },
    );
  }
}

// GET /api/v1/seller-profiles
export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  try {
    const profile = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [row] = await tx
          .select()
          .from(sellerProfiles)
          .where(eq(sellerProfiles.userId, userId))
          .limit(1);

        return row ?? null;
      },
    );

    if (!profile) {
      return NextResponse.json(
        { error: "SELLER_PROFILE_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: profile }, { status: 200 });
  } catch (error) {
    console.error("GET /api/v1/seller-profiles failed:", error);

    return NextResponse.json(
      { error: "SELLER_PROFILE_READ_FAILED" },
      { status: 500 },
    );
  }
}

// PATCH /api/v1/seller-profiles
export async function PATCH(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
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
    "displayName",
    "bio",
    "avatarUrl",
    "contactEmail",
    "contactPhone",
    "preferredContactMethod",
    "isPublished",
  ]);

  const unsupportedFields = Object.keys(input).filter(
    (field) => !allowedFields.has(field),
  );

  if (unsupportedFields.length > 0) {
    return NextResponse.json(
      { error: "UNSUPPORTED_FIELDS", fields: unsupportedFields },
      { status: 400 },
    );
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json(
      { error: "EMPTY_UPDATE" },
      { status: 400 },
    );
  }

  const updates: Partial<typeof sellerProfiles.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if ("displayName" in input) {
    if (
      typeof input.displayName !== "string" ||
      input.displayName.trim().length === 0 ||
      input.displayName.trim().length > 100
    ) {
      return NextResponse.json(
        { error: "INVALID_DISPLAY_NAME" },
        { status: 400 },
      );
    }

    updates.displayName = input.displayName.trim();
  }

  if ("bio" in input) {
    if (
      input.bio !== null &&
      (typeof input.bio !== "string" || input.bio.length > 2000)
    ) {
      return NextResponse.json(
        { error: "INVALID_BIO" },
        { status: 400 },
      );
    }

    updates.bio =
      typeof input.bio === "string" ? input.bio.trim() || null : null;
  }

  if ("avatarUrl" in input) {
    if (input.avatarUrl === null) {
      updates.avatarUrl = null;
    } else if (typeof input.avatarUrl === "string") {
      try {
        const url = new URL(input.avatarUrl);

        if (
          !["https:", "http:"].includes(url.protocol) ||
          input.avatarUrl.length > 2048
        ) {
          throw new Error("Invalid URL");
        }

        updates.avatarUrl = url.toString();
      } catch {
        return NextResponse.json(
          { error: "INVALID_AVATAR_URL" },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "INVALID_AVATAR_URL" },
        { status: 400 },
      );
    }
  }

  if ("contactEmail" in input) {
    if (input.contactEmail === null) {
      updates.contactEmail = null;
    } else if (
      typeof input.contactEmail === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail.trim())
    ) {
      updates.contactEmail = input.contactEmail.trim().toLowerCase();
    } else {
      return NextResponse.json(
        { error: "INVALID_CONTACT_EMAIL" },
        { status: 400 },
      );
    }
  }

  if ("contactPhone" in input) {
    if (input.contactPhone === null) {
      updates.contactPhone = null;
    } else if (
      typeof input.contactPhone === "string" &&
      /^[+()\d .-]{7,25}$/.test(input.contactPhone.trim()) &&
      (input.contactPhone.match(/\d/g) ?? []).length >= 7
    ) {
      updates.contactPhone = input.contactPhone.trim();
    } else {
      return NextResponse.json(
        { error: "INVALID_CONTACT_PHONE" },
        { status: 400 },
      );
    }
  }

  if ("preferredContactMethod" in input) {
    if (
      input.preferredContactMethod !== "email" &&
      input.preferredContactMethod !== "phone"
    ) {
      return NextResponse.json(
        { error: "INVALID_PREFERRED_CONTACT_METHOD" },
        { status: 400 },
      );
    }

    updates.preferredContactMethod = input.preferredContactMethod;
  }

  if ("isPublished" in input) {
    if (typeof input.isPublished !== "boolean") {
      return NextResponse.json(
        { error: "INVALID_IS_PUBLISHED" },
        { status: 400 },
      );
    }

    updates.isPublished = input.isPublished;
  }

  try {
    const result = await withAppUserTransaction(userId, async (tx) => {
      const [current] = await tx
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, userId))
        .limit(1);

      if (!current) {
        return { status: "not-found" as const };
      }

      const contactMethod =
        updates.preferredContactMethod ?? current.preferredContactMethod;

      const contactEmail = Object.hasOwn(updates, "contactEmail")
        ? updates.contactEmail
        : current.contactEmail;

      const contactPhone = Object.hasOwn(updates, "contactPhone")
        ? updates.contactPhone
        : current.contactPhone;

      if (
        (contactMethod === "email" && !contactEmail) ||
        (contactMethod === "phone" && !contactPhone)
      ) {
        return { status: "invalid-contact" as const };
      }

      const [existingListing] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.sellerUserId, userId))
        .limit(1);
      const profileWillBePublished = updates.isPublished ?? current.isPublished;
      if (existingListing && !profileWillBePublished) {
        return { status: "listings-require-public-profile" as const };
      }

      const [updated] = await tx
        .update(sellerProfiles)
        .set(updates)
        .where(eq(sellerProfiles.userId, userId))
        .returning();

      if (!updated) {
        return { status: "not-found" as const };
      }

      return { status: "ok" as const, profile: updated };
    });

    if (result.status === "not-found") {
      return NextResponse.json(
        { error: "SELLER_PROFILE_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (result.status === "invalid-contact") {
      return NextResponse.json(
        {
          error: "INVALID_CONTACT_CONFIGURATION",
          message:
            "The preferred contact method must have a corresponding contact detail.",
        },
        { status: 400 },
      );
    }

    if (result.status === "listings-require-public-profile") {
      return NextResponse.json(
        {
          error: "SELLER_PROFILE_MUST_BE_PUBLIC",
          message: "A seller profile with listings must be public. Publish your profile or delete your listings before making it private.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { data: result.profile },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /api/v1/seller-profiles failed:", error);

    return NextResponse.json(
      { error: "SELLER_PROFILE_UPDATE_FAILED" },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/seller-profiles
export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  try {
    const result = await withAppUserTransaction(
      userId,
      async (tx) => {
        const [profile] = await tx
          .select({ userId: sellerProfiles.userId })
          .from(sellerProfiles)
          .where(eq(sellerProfiles.userId, userId))
          .limit(1);

        if (!profile) {
          return { status: "not-found" as const };
        }

        const [listing] = await tx
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.sellerUserId, userId))
          .limit(1);

        if (listing) {
          return { status: "has-listings" as const };
        }

        const [deleted] = await tx
          .delete(sellerProfiles)
          .where(eq(sellerProfiles.userId, userId))
          .returning({ userId: sellerProfiles.userId });

        if (!deleted) {
          return { status: "not-found" as const };
        }

        return { status: "deleted" as const };
      },
    );

    if (result.status === "not-found") {
      return NextResponse.json(
        { error: "SELLER_PROFILE_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (result.status === "has-listings") {
      return NextResponse.json(
        {
          error: "SELLER_HAS_LISTINGS",
          message:
            "Delete your listings before deleting your seller profile.",
        },
        { status: 409 },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/v1/seller-profiles failed:", error);

    return NextResponse.json(
      { error: "SELLER_PROFILE_DELETE_FAILED" },
      { status: 500 },
    );
  }
}