import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const STORAGE_BUCKET = "property-images";

const MEDIA_EXTENSIONS = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/gif": "gif",
} as const;

const EXTENSION_CONTENT_TYPES: Record<
  string,
  SupportedMediaContentType
> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  gif: "image/gif",
};

export type SupportedMediaContentType =
  keyof typeof MEDIA_EXTENSIONS;

export type ListingMediaKind = "image" | "video";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAllowedListingMediaFilename(
  filename: string,
): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 255 &&
    filename !== "." &&
    filename !== ".." &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(filename) &&
    /^[a-zA-Z0-9][a-zA-Z0-9 ._()-]*\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/i.test(
      filename,
    )
  );
}

function createStorageAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

type StorageAdminClient = ReturnType<
  typeof createStorageAdminClient
>;

let storageAdminClient: StorageAdminClient | undefined;

function getStorageAdminClient(): StorageAdminClient {
  if (!storageAdminClient) {
    storageAdminClient = createStorageAdminClient();
  }

  return storageAdminClient;
}

/**
 * Creates a signed upload capability for a new listing media path.
 *
 * The caller must authenticate the user and verify listing ownership
 * before invoking this function.
 *
 * This function does not write to application tables.
 */
export async function createListingMediaUpload(input: {
  listingId: string;
  contentType: SupportedMediaContentType;
}): Promise<{
  path: string;
  token: string;
  contentType: SupportedMediaContentType;
  mediaKind: ListingMediaKind;
}> {
  const { listingId, contentType } = input;

  if (!UUID_PATTERN.test(listingId)) {
    throw new Error("Invalid listing ID.");
  }

  if (!Object.hasOwn(MEDIA_EXTENSIONS, contentType)) {
    throw new Error("Unsupported media content type.");
  }

  const extension = MEDIA_EXTENSIONS[contentType];
  const path = `listings/${listingId}/${randomUUID()}.${extension}`;

  const { data, error } = await getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });

  if (error) {
    throw new Error("Failed to create listing media upload capability.");
  }

  if (!data?.path || !data.token) {
    throw new Error("Supabase did not return an upload path and token.");
  }

  return {
    path: data.path,
    token: data.token,
    contentType,
    mediaKind: contentType.startsWith("image/")
      ? "image"
      : "video",
  };
}

export type ListingMediaObjectInfo = {
  path: string;
  filename: string;
  size: number;
  contentType: string;
  expectedContentType: SupportedMediaContentType;
  mediaKind: ListingMediaKind;
};

/**
 * Inspects an uploaded object without exposing the privileged Storage client.
 * The calling route must authenticate the user and check listing ownership.
*/

export async function inspectListingMediaObject(input: {
  listingId: string;
  path: string;
}): Promise<ListingMediaObjectInfo | null> {
  const { listingId, path } = input;

  if (!UUID_PATTERN.test(listingId)) {
    throw new Error("Invalid listing ID.");
  }

  const parts = path.split("/");

  if (
    parts.length !== 3 ||
    parts[0] !== "listings" ||
    parts[1] !== listingId
  ) {
    throw new Error("Invalid listing media path.");
  }

  const filename = parts[2];

  const filenameMatch = filename.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/i,
  );

  if (!filenameMatch) {
    throw new Error("Invalid listing media filename.");
  }

  const extension = filenameMatch[2].toLowerCase();
  const expectedContentType = EXTENSION_CONTENT_TYPES[extension];

  if (!expectedContentType) {
    throw new Error("Unsupported listing media extension.");
  }

  const bucket = getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET);

  const { data: exists } = await bucket.exists(path);

  if (!exists) {
    return null;
  }

  const { data, error } = await bucket.info(path);

  if (error || !data) {
    throw new Error("Failed to inspect the uploaded media object.");
  }

  const size = Number(data.size);
  const rawContentType =
    data.contentType ?? data.metadata?.mimetype;

  const contentType =
    typeof rawContentType === "string"
      ? rawContentType.split(";")[0].trim().toLowerCase()
      : "";

  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Stored media has invalid size metadata.");
  }

  return {
    path,
    filename,
    size,
    contentType,
    expectedContentType,
    mediaKind: expectedContentType.startsWith("image/")
      ? "image"
      : "video",
  };
}



/**
 * Creates signed URLs only for media filenames registered
 * on the listing. Uses the server-only Storage admin client.
*/

export async function getListingMediaUrls(input: {
  listingId: string;
  filenames: string[];
}): Promise<string[]> {
  const { listingId, filenames } = input;

  if (!UUID_PATTERN.test(listingId)) {
    throw new Error("Invalid listing ID.");
  }

  if (filenames.length === 0) {
    return [];
  }

  // Preserve legacy filenames, including spaces and parentheses,
  // while rejecting path traversal and nested paths.
  const safeFilenames = filenames.filter(
    (filename) =>
      typeof filename === "string" &&
      filename.length > 0 &&
      filename.length <= 255 &&
      filename !== "." &&
      filename !== ".." &&
      !filename.includes("/") &&
      !filename.includes("\\") &&
      !/[\u0000-\u001f\u007f]/.test(filename),
  );

  const bucket = getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET);

  const folderPath = `listings/${listingId}`;

  const { data: files, error: listError } =
    await bucket.list(folderPath, { limit: 1000 });

  if (listError) {
    console.error("Failed to list listing media:", listError);
    return [];
  }

  const storageFilenames = new Set(
    (files ?? [])
      .map((file) => file.name)
      .filter(Boolean),
  );

  // The database remains authoritative: do not serve files
  // that aren't registered in the listing's media array.
  const existingFilenames = safeFilenames.filter(
    (filename) => storageFilenames.has(filename),
  );

  const results = await Promise.all(
    existingFilenames.map(async (filename) => {
      const filePath = `${folderPath}/${filename}`;

      const { data, error } = await bucket.createSignedUrl(
        filePath,
        60 * 60,
      );

      if (error || !data?.signedUrl) {
        console.error("Failed to sign listing media:", filePath);
        return null;
      }

      return data.signedUrl;
    }),
  );

  return results.filter(
    (url): url is string => url !== null,
  );
}

export type ListingMediaPreview = {
  filename: string;
  previewUrl: string | null;
  mediaKind: ListingMediaKind;
};

/**
 * Signs previews for registered filenames while preserving their order and
 * retaining rows whose Storage object is unavailable.
 */
export async function getListingMediaPreviews(input: {
  listingId: string;
  filenames: string[];
}): Promise<ListingMediaPreview[]> {
  const { listingId, filenames } = input;

  if (!UUID_PATTERN.test(listingId)) {
    throw new Error("Invalid listing ID.");
  }

  if (filenames.length === 0) {
    return [];
  }

  const safeFilenames = new Set(
    filenames.filter(isAllowedListingMediaFilename),
  );
  const bucket = safeFilenames.size > 0
    ? getStorageAdminClient().storage.from(STORAGE_BUCKET)
    : null;

  return Promise.all(
    filenames.map(async (filename): Promise<ListingMediaPreview> => {
      const extension = filename.split(".").pop()?.toLowerCase() ?? "";
      const mediaKind = ["mp4", "webm", "mov"].includes(extension)
        ? "video"
        : "image";

      if (!bucket || !safeFilenames.has(filename)) {
        return { filename, previewUrl: null, mediaKind };
      }

      const path = `listings/${listingId}/${filename}`;
      try {
        const { data, error } = await bucket.createSignedUrl(path, 60 * 60);

        if (error || !data?.signedUrl) {
          console.error("Failed to sign listing media preview:", path, error);
          return { filename, previewUrl: null, mediaKind };
        }

        return {
          filename,
          previewUrl: data.signedUrl,
          mediaKind,
        };
      } catch (error) {
        console.error("Failed to sign listing media preview:", path, error);
        return { filename, previewUrl: null, mediaKind };
      }
    }),
  );
}

/**
 * Remove files associated with a listing.
 * The caller must first verify listing ownership or perform an
 * authorized listing deletion. This function only accepts filenames,
 * never arbitrary bucket paths.
*/
export async function deleteListingMediaObjects(input: {
  listingId: string;
  filenames: string[];
}): Promise<void> {
  const { listingId, filenames } = input;

  if (!UUID_PATTERN.test(listingId)) {
    throw new Error("Invalid listing ID.");
  }

  const uniqueFilenames: string[] = [...new Set(filenames)];

  if (uniqueFilenames.length === 0) {
    return;
  }

  for (const filename of uniqueFilenames) {
    if (
      typeof filename !== "string" ||
      !isAllowedListingMediaFilename(filename)
    ) {
      throw new Error("Invalid listing media filename.");
    }
  }

  const paths = uniqueFilenames.map(
    (filename: string) => `listings/${listingId}/${filename}`,
  );

  const { error } = await getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error("Failed to remove listing media from Storage.");
  }
}


const AVATAR_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
} as const;

export type SupportedAvatarContentType = keyof typeof AVATAR_EXTENSIONS;
export const MAX_USER_AVATAR_BYTES = 5 * 1024 * 1024;

/** Only owner-scoped avatar objects in the private property-images bucket are accepted. */
function isOwnedUserAvatarPath(userId: string, path: string): boolean {
  if (!UUID_PATTERN.test(userId)) return false;
  const safeUserId = userId.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    "^avatars/" + safeUserId +
      "/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|png|webp|avif|gif)$",
    "i",
  ).test(path);
}

/** Uploads a small, validated profile image to a user-owned private Storage path. */
export async function uploadUserAvatar(input: {
  userId: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<string> {
  const { userId, contentType, bytes } = input;
  if (!UUID_PATTERN.test(userId)) throw new Error("Invalid authenticated user ID.");
  if (!Object.hasOwn(AVATAR_EXTENSIONS, contentType)) {
    throw new Error("Unsupported avatar image format.");
  }
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_USER_AVATAR_BYTES) {
    throw new Error("Avatar images must be 5 MB or smaller.");
  }

  const path = `avatars/${userId.toLowerCase()}/${randomUUID()}.${AVATAR_EXTENSIONS[contentType as SupportedAvatarContentType]}`;
  const { error } = await getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error("The avatar image could not be uploaded.");
  }
  return path;
}

/** Resolves a safe public avatar URL or signs an owned private Storage path. */
export async function getUserAvatarUrl(input: {
  userId: string;
  image: string | null | undefined;
}): Promise<string | null> {
  const { userId, image } = input;
  if (!image) return null;

  let externalUrl: URL | null = null;
  try {
    externalUrl = new URL(image);
  } catch {
    externalUrl = null;
  }
  if (externalUrl && (externalUrl.protocol === "http:" || externalUrl.protocol === "https:")) {
    return image;
  }

  if (!isOwnedUserAvatarPath(userId, image)) return null;

  const { data, error } = await getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(image, 60 * 60);

  if (error || !data?.signedUrl) {
    console.error("Failed to sign user avatar URL.");
    return null;
  }
  return data.signedUrl;
}

/** Deletes only a user's own generated avatar object; external URLs are never touched. */
export async function deleteUserAvatarObject(input: {
  userId: string;
  path: string | null | undefined;
}): Promise<void> {
  const { userId, path } = input;
  if (!path || !isOwnedUserAvatarPath(userId, path)) return;

  const { error } = await getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) throw new Error("The previous avatar could not be removed.");
}
