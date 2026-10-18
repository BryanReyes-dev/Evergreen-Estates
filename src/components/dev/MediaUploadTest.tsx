"use client";

import { useState, type FormEvent } from "react";
import { uploadListingMedia } from "@/lib/media/upload-listing-media";

const DEFAULT_LISTING_ID = "bedc6382-8ad0-4323-931f-0011e6d3a2a8";

type UploadResult = Awaited<ReturnType<typeof uploadListingMedia>>;

export default function MediaUploadTest() {
  const [listingId, setListingId] = useState(DEFAULT_LISTING_ID);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Choose an image or video first.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const uploaded = await uploadListingMedia(
        listingId.trim(),
        file,
        setProgress,
      );

      setResult(uploaded);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-12 text-white">
      <h1 className="text-3xl font-semibold">Media Upload Test</h1>

      <p className="mt-3 text-white/70">
        Development-only tool for testing signed uploads and media
        registration. Use a non-sensitive test image or video.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <label htmlFor="listingId" className="block font-medium">
            Listing ID
          </label>

          <input
            id="listingId"
            value={listingId}
            onChange={(event) => setListingId(event.target.value)}
            required
            className="w-full rounded-lg border border-white/20 bg-[#202324] px-3 py-3"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="mediaFile" className="block font-medium">
            Choose an image or video
          </label>

          <input
            id="mediaFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime"
            required
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
              setResult(null);
              setProgress(0);
            }}
            className="block w-full rounded-lg border border-white/20 bg-[#202324] p-3"
          />

          {file && (
            <p className="text-sm text-white/60">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MiB
            </p>
          )}
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading</span>
              <span>{progress}%</span>
            </div>

            <progress
              value={progress}
              max={100}
              className="w-full"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file || !listingId.trim()}
          className="w-full rounded-lg bg-[#78b75c] px-4 py-3 font-semibold text-[#141616] disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload media"}
        </button>
      </form>

      {error && (
        <section
          role="alert"
          className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4"
        >
          <h2 className="font-semibold">Upload failed</h2>
          <p className="mt-2 break-words text-sm">{error}</p>
        </section>
      )}

      {result && (
        <section className="mt-6 rounded-lg border border-green-500/40 bg-green-500/10 p-4">
          <h2 className="font-semibold">Media registered successfully</h2>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}