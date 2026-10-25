"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { readApiData } from "@/lib/api/client";

export function ReviewForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

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
      await readApiData<{ id: string }>(
        await fetch("/api/v1/listings/" + encodeURIComponent(listingId) + "/reviews", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: numericRating, comment: normalizedComment }),
        }),
        "Your review could not be saved. Try again.",
      );
      setComment("");
      setRating("5");
      setSuccess("Your review was submitted.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your review could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (sessionPending) {
    return <p className="mt-6 text-sm text-white/60">Checking sign-in status…</p>;
  }

  if (!session?.user) {
    return (
      <p className="mt-6 rounded-lg border border-white/10 p-4 text-sm text-white/70">
        <Link href="/auth" className="font-medium text-white underline underline-offset-4">
          Sign in
        </Link>{" "}
        to leave a review.
      </p>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-[#202324] p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-white">Write a review</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <label htmlFor="review-rating" className="text-sm font-medium text-white">
            Rating
          </label>
          <select
            id="review-rating"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            disabled={pending}
            className="min-h-11 w-full rounded-md border border-white/20 bg-[#141616] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
          >
            <option value="5">5 — Excellent</option>
            <option value="4">4 — Very good</option>
            <option value="3">3 — Good</option>
            <option value="2">2 — Fair</option>
            <option value="1">1 — Poor</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="review-comment" className="text-sm font-medium text-white">
            Comment
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            required
            maxLength={5000}
            disabled={pending}
            placeholder="Share what you think about this property…"
            className="w-full rounded-md border border-white/20 bg-[#141616] px-3 py-2 text-sm text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
          />
          <p className="text-right text-xs text-white/50">{comment.length}/5000</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {success && <output className="block text-sm text-green-300">{success}</output>}
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Submitting…" : "Submit review"}
        </Button>
      </form>
    </section>
  );
}
