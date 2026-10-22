import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { withAppUserTransaction } from "@/db/drizzle/app-client";
import { users } from "@/db/schema";
import {
  deleteUserAvatarObject,
  getUserAvatarUrl,
  MAX_USER_AVATAR_BYTES,
  uploadUserAvatar,
} from "@/db/supabase/storage-admin";
import { getAuthenticatedUserId } from "@/lib/api/get-authenticated-user-id";

export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function detectedContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4))) return "image/avif";
  return null;
}

/** POST /api/v1/users/me/avatar — upload and attach a validated image to this account. */
export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return errorResponse("UNAUTHENTICATED", "Sign in to upload an avatar.", 401);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return errorResponse("INVALID_MULTIPART_FORM", "Choose an image file and try again.", 400);
  }

  if (!(file instanceof File)) return errorResponse("AVATAR_REQUIRED", "Choose an image file.", 400);
  if (file.size < 1 || file.size > MAX_USER_AVATAR_BYTES) {
    return errorResponse("AVATAR_TOO_LARGE", "Avatar images must be between 1 byte and 5 MB.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const actualType = detectedContentType(bytes);
  if (!actualType || actualType !== file.type.toLowerCase()) {
    return errorResponse("INVALID_AVATAR_TYPE", "Upload a valid JPEG, PNG, WebP, AVIF, or GIF image.", 400);
  }

  let uploadedPath: string | null = null;
  let attached = false;
  try {
    uploadedPath = await uploadUserAvatar({ userId, contentType: actualType, bytes });
    const result = await withAppUserTransaction(userId, async (tx) => {
      const [current] = await tx
        .select({ image: users.image })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!current) return null;

      const [updated] = await tx
        .update(users)
        .set({ image: uploadedPath, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId))
        .returning({ image: users.image });

      return updated ? { oldImage: current.image, image: updated.image } : null;
    });

    if (!result) {
      await deleteUserAvatarObject({ userId, path: uploadedPath });
      return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);
    }

    attached = true;

    try {
      if (result.oldImage && result.oldImage !== uploadedPath) {
        await deleteUserAvatarObject({ userId, path: result.oldImage });
      }
    } catch (error) {
      console.error("Old avatar cleanup failed after a successful replacement.", error);
    }

    let imageUrl: string | null = null;
    try {
      imageUrl = await getUserAvatarUrl({ userId, image: result.image });
    } catch (error) {
      console.error("Avatar uploaded but signed URL generation failed.", error);
    }

    return NextResponse.json({
      data: { image: result.image, imageUrl },
    }, { status: 200 });
  } catch (error) {
    if (uploadedPath && !attached) {
      try { await deleteUserAvatarObject({ userId, path: uploadedPath }); } catch { /* best-effort orphan cleanup */ }
    }
    console.error("Avatar upload failed:", error);
    return errorResponse("AVATAR_UPLOAD_FAILED", "Your avatar could not be uploaded. Try again.", 500);
  }
}

/** DELETE /api/v1/users/me/avatar — restore the initials avatar. */
export async function DELETE(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return errorResponse("UNAUTHENTICATED", "Sign in to manage your avatar.", 401);

  try {
    const result = await withAppUserTransaction(userId, async (tx) => {
      const [current] = await tx
        .select({ image: users.image })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!current) return { found: false as const };

      await tx.update(users)
        .set({ image: null, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId));
      return { found: true as const, image: current.image };
    });

    if (!result.found) return errorResponse("USER_NOT_FOUND", "Your account could not be found.", 404);
    await deleteUserAvatarObject({ userId, path: result.image });
    return NextResponse.json({ data: { image: null, imageUrl: null } }, { status: 200 });
  } catch (error) {
    console.error("Avatar removal failed:", error);
    return errorResponse("AVATAR_REMOVE_FAILED", "Your avatar could not be removed. Try again.", 500);
  }
}
