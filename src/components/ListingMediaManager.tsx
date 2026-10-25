"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_CAPTION_FILE_BYTES, validateWebVttCaptionFile } from "@/lib/media/captions";
import { MAX_MEDIA_FILE_BYTES } from "@/lib/media/file-limits";
import {
  SUPPORTED_LISTING_MEDIA_TYPES,
  uploadListingMedia,
  validateListingMediaFile,
} from "@/lib/media/upload-listing-media";

type ListingMediaEntry = {
  filename: string;
  previewUrl: string | null;
  mediaKind: "image" | "video";
  captionUrl: string | null;
};

type ListingMediaData = {
  listingId: string;
  media: ListingMediaEntry[];
};

class MediaRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MediaRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null) as Promise<unknown>;
}

function getApiErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  return typeof payload.error.message === "string"
    ? payload.error.message
    : null;
}

async function requireSuccessfulResponse(
  response: Response,
  fallbackMessage: string,
): Promise<unknown> {
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new MediaRequestError(
      response.status,
      getApiErrorMessage(payload) ?? fallbackMessage,
    );
  }

  return payload;
}

async function readData<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const payload = await requireSuccessfulResponse(response, fallbackMessage);

  if (!isRecord(payload) || !("data" in payload)) {
    throw new Error(fallbackMessage);
  }

  return payload.data as T;
}

function describeError(
  error: unknown,
  fallbackMessage: string,
  latestMediaLoaded = false,
): string {
  if (error instanceof MediaRequestError) {
    if (error.status === 401) {
      return "Your sign-in session is missing or expired. Sign in, then refresh this page.";
    }

    if (error.status === 404) {
      return "This listing or media file is unavailable to your account. Refresh to check the current gallery.";
    }

    if (error.status === 409) {
      return latestMediaLoaded
        ? "The registered media changed. The latest gallery was refreshed; review it and save again."
        : "The registered media changed, but the latest gallery could not be loaded. Use Refresh gallery before trying again.";
    }

    return error.message || fallbackMessage;
  }

  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage;
}

function mediaEndpoint(listingId: string): string {
  return `/api/v1/listings/${encodeURIComponent(listingId)}/media`;
}

function CaptionedListingVideoPreview({
  src,
  filename,
  captionUrl,
}: {
  src: string;
  filename: string;
  captionUrl: string;
}) {
  return (
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      aria-label={`Video preview: ${filename}`}
      className="h-full w-full object-contain"
    >
      <track
        kind="captions"
        src={captionUrl}
        srcLang="en"
        label="English captions"
        default
      />
    </video>
  );
}

function ListingVideoPreview({
  src,
  filename,
  captionUrl,
}: {
  src: string;
  filename: string;
  captionUrl: string | null;
}) {
  if (captionUrl) {
    return (
      <CaptionedListingVideoPreview
        src={src}
        filename={filename}
        captionUrl={captionUrl}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#202324] p-3 text-center">
      <p className="text-xs text-white/70">
        Upload English captions (.vtt) to preview this video.
      </p>
    </div>
  );
}

export function ListingMediaManager({
  listingId,
}: {
  listingId: string;
}) {
  const [media, setMedia] = useState<ListingMediaEntry[]>([]);
  const [savedFilenames, setSavedFilenames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [captionUploadingFilename, setCaptionUploadingFilename] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async (): Promise<ListingMediaData> => {
    const response = await fetch(mediaEndpoint(listingId), {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await readData<ListingMediaData>(
      response,
      "Unable to load this listing's media.",
    );

    if (!Array.isArray(data.media)) {
      throw new Error("The server returned an invalid media list.");
    }

    return data;
  }, [listingId]);

  const refreshMedia = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    setLoadError(null);

    try {
      const data = await fetchMedia();
      setMedia(data.media);
      setSavedFilenames(data.media.map((item) => item.filename));
      setCanManage(true);
      setLoadError(null);
      return true;
    } catch (cause) {
      setMedia([]);
      setSavedFilenames([]);
      setCanManage(false);
      setLoadError(
        describeError(cause, "Unable to load this listing's media."),
      );
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchMedia]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMedia() {
      try {
        const data = await fetchMedia();
        if (cancelled) return;

        setMedia(data.media);
        setSavedFilenames(data.media.map((item) => item.filename));
        setCanManage(true);
        setLoadError(null);
      } catch (cause) {
        if (cancelled) return;

        setMedia([]);
        setSavedFilenames([]);
        setCanManage(false);
        setLoadError(
          describeError(cause, "Unable to load this listing's media."),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialMedia();
    return () => {
      cancelled = true;
    };
  }, [fetchMedia]);

  const filenames = media.map((item) => item.filename);
  const hasUnsavedOrder =
    filenames.length !== savedFilenames.length ||
    filenames.some((filename, index) => filename !== savedFilenames[index]);
  const busy = refreshing || uploading || captionUploadingFilename !== null || saving || deletingFilename !== null;

  function moveTo(index: number, destination: number) {
    if (destination < 0 || destination >= media.length) return;

    setMedia((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(destination, 0, item);
      return next;
    });
    setActionError(null);
    setSuccessMessage(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setSelectedFile(file);
    setActionError(null);
    setSuccessMessage(null);

    if (!file) return;

    const validationError = validateListingMediaFile(file);

    if (validationError) {
      setSelectedFile(null);
      event.currentTarget.value = "";
      setActionError(validationError);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setActionError("Choose one image or video to upload.");
      return;
    }

    const validationError = validateListingMediaFile(selectedFile);

    if (validationError) {
      setActionError(validationError);
      return;
    }

    setActionError(null);
    setSuccessMessage(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadListingMedia(
        listingId,
        selectedFile,
        setUploadProgress,
      );

      await refreshMedia();
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccessMessage(`${result.filename} was uploaded to the gallery.`);
    } catch (cause) {
      await refreshMedia();
      setActionError(
        describeError(cause, "The media upload could not be completed."),
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleCaptionFileChange(
    event: ChangeEvent<HTMLInputElement>,
    filename: string,
  ) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";

    if (!file) return;

    const content = await file.text();
    const validationError = validateWebVttCaptionFile(file, content);
    if (validationError) {
      setActionError(validationError);
      setSuccessMessage(null);
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    setActionError(null);
    setSuccessMessage(null);
    setCaptionUploadingFilename(filename);

    try {
      const response = await fetch(
        `${mediaEndpoint(listingId)}/${encodeURIComponent(filename)}/captions`,
        {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        },
      );
      await readData<{ listingId: string; videoFilename: string; filename: string; uploaded: boolean }>(
        response,
        "Unable to upload video captions.",
      );

      await refreshMedia();
      setSuccessMessage(`English captions were saved for ${filename}.`);
    } catch (cause) {
      setActionError(
        describeError(cause, "Unable to upload video captions."),
      );
    } finally {
      setCaptionUploadingFilename(null);
    }
  }

  async function saveOrder() {
    setActionError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const response = await fetch(mediaEndpoint(listingId), {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filenames }),
      });
      const data = await readData<{
        listingId: string;
        filenames: string[];
      }>(response, "Unable to save the gallery order.");

      const positionByFilename = new Map(
        data.filenames.map((filename, index) => [filename, index]),
      );
      setMedia((current) =>
        [...current].sort(
          (left, right) =>
            (positionByFilename.get(left.filename) ?? 0) -
            (positionByFilename.get(right.filename) ?? 0),
        ),
      );
      setSavedFilenames(data.filenames);
      setSuccessMessage("Gallery order saved.");
    } catch (cause) {
      const latestMediaLoaded = await refreshMedia();
      setActionError(
        describeError(
          cause,
          "Unable to save the gallery order.",
          latestMediaLoaded,
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMedia(filename: string) {
    setActionError(null);
    setSuccessMessage(null);
    setDeletingFilename(filename);

    try {
      const response = await fetch(
        `${mediaEndpoint(listingId)}/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        },
      );

      await requireSuccessfulResponse(
        response,
        "The media file could not be deleted.",
      );
      await refreshMedia();
      setSuccessMessage(`${filename} was deleted from the gallery.`);
    } catch (cause) {
      await refreshMedia();
      setActionError(
        describeError(cause, "The media file could not be deleted."),
      );
    } finally {
      setDeletingFilename(null);
      setDeleteConfirmation(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#8fc879]">
            Listing media
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            Manage your gallery
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
            Upload photos and videos, choose the gallery order, and move a photo
            to the first position to make it the listing thumbnail.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setActionError(null);
            setSuccessMessage(null);
            void refreshMedia();
          }}
          disabled={busy}
        >
          {refreshing ? "Refreshing..." : "Refresh gallery"}
        </Button>
      </div>

      <div className="mt-8 rounded-2xl border border-white/15 bg-white/[0.04] p-4 sm:p-6">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listing-media-file" className="text-white">
              Add an image or video
            </Label>
            <Input
              ref={fileInputRef}
              id="listing-media-file"
              type="file"
              accept={SUPPORTED_LISTING_MEDIA_TYPES.join(",")}
              onChange={handleFileChange}
              disabled={!canManage || busy}
              aria-describedby="listing-media-file-help"
              className="border-white/20 bg-[#202324] text-white file:text-white"
            />
            <p id="listing-media-file-help" className="text-sm text-white/60">
              JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, or MOV. Maximum size: {MAX_MEDIA_FILE_BYTES.toLocaleString()} bytes (50 MB).
            </p>
            {selectedFile && (
              <p className="break-all text-sm text-white/75">
                Selected: {selectedFile.name} · {selectedFile.size.toLocaleString()} bytes
              </p>
            )}
          </div>

          <Button type="submit" disabled={!canManage || busy || !selectedFile}>
            {uploading ? "Uploading..." : "Upload media"}
          </Button>
        </form>

        {uploading && (
          <div className="mt-5 space-y-2">
            <div className="flex justify-between gap-3 text-sm">
              <p aria-live="polite" className="break-all">
                Uploading {selectedFile?.name}
              </p>
              <span>{uploadProgress}%</span>
            </div>
            <progress
              aria-label={`Upload progress for ${selectedFile?.name ?? "media"}`}
              value={uploadProgress}
              max={100}
              className="w-full accent-[#78b75c]"
            />
          </div>
        )}
        {captionUploadingFilename && (
          <p aria-live="polite" className="mt-4 text-sm text-white/75">
            Uploading English captions for {captionUploadingFilename}.
          </p>
        )}
      </div>

      {loadError && (
        <div role="alert" className="mt-6 rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
          {loadError}
        </div>
      )}

      {actionError && (
        <div role="alert" className="mt-6 rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-100">
          {actionError}
        </div>
      )}

      {successMessage && (
        <p aria-live="polite" className="mt-6 rounded-xl border border-green-400/40 bg-green-950/30 p-4 text-sm text-green-100">
          {successMessage}
        </p>
      )}

      {loading ? (
        <p aria-live="polite" className="mt-8 text-white/75">
          Loading your gallery...
        </p>
      ) : canManage ? (
        <section className="mt-8" aria-labelledby="gallery-order-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="gallery-order-heading" className="text-xl font-semibold">
                Gallery order
              </h2>
              <p className="mt-1 text-sm text-white/65">
                {media.length} {media.length === 1 ? "file" : "files"} · the first item is shown first on the listing.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void saveOrder()}
              disabled={!hasUnsavedOrder || busy}
            >
              {saving ? "Saving order..." : "Save order"}
            </Button>
          </div>

          {hasUnsavedOrder && (
            <p className="mb-4 text-sm text-[#bfe3ae]">
              Order changes are not saved yet.
            </p>
          )}

          {media.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/25 p-8 text-center">
              <h3 className="text-lg font-medium">No media uploaded yet</h3>
              <p className="mt-2 text-sm text-white/65">
                Add a photo, GIF, or video above to start your gallery.
              </p>
            </div>
          ) : (
            <ol className="space-y-4" aria-label="Listing media in display order">
              {media.map((item, index) => (
                <li
                  key={`${item.filename}-${index}`}
                  className="grid grid-cols-1 gap-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center lg:grid-cols-[13rem_minmax(0,1fr)_auto]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black/40">
                    {item.previewUrl ? (
                      item.mediaKind === "video" ? (
                        <ListingVideoPreview src={item.previewUrl} filename={item.filename} captionUrl={item.captionUrl} />
                      ) : (
                        <Image
                          src={item.previewUrl}
                          alt={`Preview of ${item.filename}`}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, 208px"
                          className="object-contain"
                        />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/60">
                        Preview unavailable
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="break-all font-medium text-white">
                      {item.filename}
                    </p>
                    <p className="mt-1 text-sm capitalize text-white/65">
                      {item.mediaKind === "image" ? "Image or GIF" : "Video"}
                    </p>
                    {index === 0 && (
                      <p className="mt-2 inline-flex rounded-full bg-[#78b75c]/15 px-3 py-1 text-xs font-medium text-[#bfe3ae]">
                        {item.mediaKind === "image" ? "Thumbnail photo" : "First in gallery"}
                      </p>
                    )}
                    {item.mediaKind === "video" && (
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`caption-file-${index}`} className="text-white">
                          {item.captionUrl ? "Replace English captions (.vtt)" : "Add English captions (.vtt)"}
                        </Label>
                        <Input
                          id={`caption-file-${index}`}
                          type="file"
                          accept=".vtt,text/vtt"
                          disabled={!canManage || busy}
                          onChange={(event) => void handleCaptionFileChange(event, item.filename)}
                          aria-describedby={`caption-help-${index}`}
                          className="border-white/20 bg-[#202324] text-white file:text-white"
                        />
                        <p id={`caption-help-${index}`} className="text-sm text-white/60">
                          {item.captionUrl
                            ? "English captions are active, so visitors can enable video audio."
                            : `Upload a WebVTT file up to ${MAX_CAPTION_FILE_BYTES.toLocaleString()} bytes. Video playback is available after English captions are uploaded.`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${item.filename} earlier`}
                      onClick={() => moveTo(index, index - 1)}
                      disabled={busy || index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${item.filename} later`}
                      onClick={() => moveTo(index, index + 1)}
                      disabled={busy || index === media.length - 1}
                    >
                      ↓
                    </Button>
                    {item.mediaKind === "image" && index > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => moveTo(index, 0)}
                        disabled={busy}
                      >
                        Make thumbnail
                      </Button>
                    )}
                    {deleteConfirmation === item.filename ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => void deleteMedia(item.filename)}
                          disabled={busy}
                        >
                          Confirm delete
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setDeleteConfirmation(null)}
                          disabled={busy}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setDeleteConfirmation(item.filename)}
                        disabled={busy}
                        aria-label={`Delete ${item.filename}`}
                      >
                        {deletingFilename === item.filename ? "Deleting..." : "Delete"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </section>
  );
}
