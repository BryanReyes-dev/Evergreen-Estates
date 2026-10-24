"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { ensureApiSuccess, readApiData } from "@/lib/api/client";
import type { Review as ReviewType } from "@/app/types";

/** Only the author sees review mutation controls; the API still enforces ownership. */
export function ReviewActions({ review }: { review: ReviewType }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(String(review.rating));
  const [comment, setComment] = useState(review.comment);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.user?.id !== review.user_id) return null;

  const endpoint =
    "/api/v1/listings/" +
    encodeURIComponent(review.listing_id) +
    "/reviews/" +
    encodeURIComponent(review.id);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedComment = comment.trim();
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      setError("Choose a rating from 1 to 5.");
      return;
    }
    if (!normalizedComment || normalizedComment.length > 5000) {
      setError("Write a comment between 1 and 5,000 characters.");
      return;
    }

    setPending(true);
    try {
      await readApiData<unknown>(
        await fetch(endpoint, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: numericRating, comment: normalizedComment }),
        }),
        "Your review could not be updated. Try again.",
      );
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your review could not be updated.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this review? This action cannot be undone.")) return;
    setPending(true);
    setError(null);
    try {
      await ensureApiSuccess(
        await fetch(endpoint, { method: "DELETE", credentials: "same-origin" }),
        "Your review could not be deleted. Try again.",
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your review could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      {editing ? (
        <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-white/10 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-white/80">
              Rating
              <select
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                disabled={pending}
                className="min-h-11 w-full rounded-md border border-white/20 bg-[#141616] px-3 text-white"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/80">
              Comment
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={5000}
                required
                rows={3}
                disabled={pending}
                className="min-h-11 w-full rounded-md border border-white/20 bg-[#141616] px-3 py-2 text-white"
              />
            </label>
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} className="min-h-11">
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" disabled={pending} onClick={() => setEditing(false)} className="min-h-11">
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => setEditing(true)} className="min-h-10">
            Edit review
          </Button>
          <Button type="button" disabled={pending} onClick={handleDelete} className="min-h-10">
            {pending ? "Working…" : "Delete review"}
          </Button>
        </div>
      )}
      {error && !editing && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
