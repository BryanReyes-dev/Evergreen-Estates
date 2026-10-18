"use client";

import { createClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";

const BUCKET = "property-images";
const TUS_THRESHOLD = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 45_000_000;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

type UploadGrant = {
  bucket: string;
  path: string;
  token: string;
  contentType: string;
  mediaKind: "image" | "video";
  maxBytes: number;
  uploadMethod: "standard" | "tus";
};

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

let storageClient: ReturnType<typeof createClient> | undefined;

function getStorageClient() {
  if (storageClient) return storageClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing public Supabase configuration.");
  }

  storageClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return storageClient;
}

async function readApiResponse<T>(
  response: Response,
): Promise<T> {
  const result = await response.json().catch(() => null) as
    | ApiResponse<T>
    | null;

  if (!response.ok || !result?.data) {
    throw new Error(
      result?.error?.message ??
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return result.data;
}

async function uploadWithTus(
  file: File,
  grant: UploadGrant,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing public Supabase configuration.");
  }

  const hostname = new URL(supabaseUrl).hostname;

  if (!hostname.endsWith(".supabase.co")) {
    throw new Error("Could not determine the Supabase project hostname.");
  }

  const projectRef = hostname.split(".")[0];

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable/sign`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        apikey: anonKey,
        "x-signature": grant.token,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_SIZE,
      metadata: {
        bucketName: BUCKET,
        objectName: grant.path,
        contentType: file.type,
        cacheControl: "3600",
      },
      onError(error) {
        reject(error);
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percent = Math.round(
          (bytesUploaded / bytesTotal) * 100,
        );
        onProgress?.(percent);
      },
      onSuccess() {
        onProgress?.(100);
        resolve();
      },
    });

    upload.start();
  });
}

export async function uploadListingMedia(
  listingId: string,
  file: File,
  onProgress?: (percent: number) => void,
) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Choose a supported image or video format.");
  }

  const mediaKind = file.type.startsWith("image/")
    ? "image"
    : "video";

  const maxBytes = mediaKind === "image"
    ? MAX_IMAGE_BYTES
    : MAX_VIDEO_BYTES;

  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(
      `This ${mediaKind} must not exceed ${maxBytes} bytes.`,
    );
  }

  // Ask our API to authenticate the user, check listing ownership,
  // and issue a capability for one unique Storage path.
  const grantResponse = await fetch(
    `/api/v1/listings/${encodeURIComponent(listingId)}/media/upload-url`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: file.type,
        size: file.size,
      }),
    },
  );

  const grant = await readApiResponse<UploadGrant>(grantResponse);

  if (
    grant.bucket !== BUCKET ||
    !grant.path ||
    !grant.token ||
    grant.contentType !== file.type
  ) {
    throw new Error("The server returned an invalid upload capability.");
  }

  // Transfer the bytes directly from the browser to Storage.
  if (grant.uploadMethod === "tus") {
    await uploadWithTus(file, grant, onProgress);
  } else {
    const { error } = await getStorageClient()
      .storage
      .from(BUCKET)
      .uploadToSignedUrl(grant.path, grant.token, file, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    onProgress?.(100);
  }

  // Only after the transfer succeeds do we ask the API to verify
  // the stored object and register it in listings.media.
  try {
    const completionResponse = await fetch(
      `/api/v1/listings/${encodeURIComponent(listingId)}/media/complete`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: grant.path }),
      },
    );

    return await readApiResponse<{
      listingId: string;
      filename: string;
      mediaKind: "image" | "video";
      size: number;
      registered: boolean;
      alreadyRegistered: boolean;
    }>(completionResponse);
  } catch (error) {
    throw new Error(
      `The file uploaded to Storage but wasn't registered. ` +
      `Retry completion for path "${grant.path}". ` +
      `${error instanceof Error ? error.message : ""}`,
    );
  }
}