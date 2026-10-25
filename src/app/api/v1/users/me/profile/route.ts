import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { users } from "@/db/schema";
import { getUserAvatarUrl } from "@/db/supabase/storage-admin";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";
import {
  isAccountPreferences,
  normalizeAccountPreferences,
} from "@/lib/account-preferences";

export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function currentAccount(userId: string) {
  const [user] = await withAppUserTransaction(userId, async (tx) =>
    tx
      .select({
        name: users.name,
        image: users.image,
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  );

  if (!user) return null;
  return {
    name: user.name,
    image: user.image,
    imageUrl: await getUserAvatarUrl({ userId, image: user.image }),
    preferences: normalizeAccountPreferences(user.preferences),
  };
}

/** GET /api/v1/users/me/profile — only the authenticated user's profile/settings. */
export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return errorResponse("UNAUTHENTICATED", "Sign in to manage your account.", 401);

  try {
    const account = await currentAccount(userId);
    if (!account) return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);
    return NextResponse.json({ data: account }, { status: 200 });
  } catch (error) {
    console.error("GET account settings failed:", error);
    return errorResponse("ACCOUNT_READ_FAILED", "Your account settings could not be loaded. Try again.", 500);
  }
}

/** PATCH /api/v1/users/me/profile — currently updates only supported browsing preferences. */
export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return errorResponse("UNAUTHENTICATED", "Sign in to manage your account.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "The request body must be valid JSON.", 400);
  }

  if (!isRecord(body) || Object.keys(body).some((key) => key !== "preferences")) {
    return errorResponse("UNSUPPORTED_FIELD", "Only account preferences can be updated here.", 400);
  }
  if (!isAccountPreferences(body.preferences)) {
    return errorResponse("INVALID_PREFERENCES", "Choose a supported sort order and results layout.", 400);
  }

  try {
    const updated = await withAppUserTransaction(userId, async (tx) => {
      const [row] = await tx
        .update(users)
        .set({
          preferences: normalizeAccountPreferences(body.preferences),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      return row ?? null;
    });
    if (!updated) return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);

    const account = await currentAccount(userId);
    if (!account) return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);
    return NextResponse.json({ data: account }, { status: 200 });
  } catch (error) {
    console.error("PATCH account preferences failed:", error);
    return errorResponse("PREFERENCES_UPDATE_FAILED", "Your preferences could not be saved. Try again.", 500);
  }
}
