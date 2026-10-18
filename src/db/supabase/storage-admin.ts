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

  const uniqueFilenames = [...new Set(filenames)];

  for (const filename of uniqueFilenames) {
    if (
      typeof filename !== "string" ||
      filename.length === 0 ||
      filename.length > 255 ||
      filename === "." ||
      filename === ".." ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)
    ) {
      throw new Error("Invalid listing media filename.");
    }
  }

  if (uniqueFilenames.length === 0) {
    return;
  }

  const paths = uniqueFilenames.map(
    (filename) => `listings/${listingId}/${filename}`,
  );

  const { error } = await getStorageAdminClient()
    .storage
    .from(STORAGE_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error("Failed to remove listing media from Storage.");
  }
}