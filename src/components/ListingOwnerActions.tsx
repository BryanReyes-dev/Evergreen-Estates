"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ensureApiSuccess } from "@/lib/api/client";

/** These controls are rendered only after the server verifies listing ownership. */
export function ListingOwnerActions({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this listing and its registered media? This action cannot be undone.")) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await ensureApiSuccess(
        await fetch("/api/v1/listings/" + encodeURIComponent(listingId), {
          method: "DELETE",
          credentials: "same-origin",
        }),
        "The listing could not be deleted. Try again.",
      );
      router.replace("/profile");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The listing could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href={"/listings/" + encodeURIComponent(listingId) + "/edit"}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
        >
          Edit listing
        </Link>
        <Button type="button" disabled={pending} onClick={handleDelete} className="min-h-11">
          {pending ? "Deleting…" : "Delete listing"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
