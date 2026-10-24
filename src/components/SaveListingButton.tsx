"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useSavedListings } from "@/components/SavedListingsProvider";

export function SaveListingButton({ listingId }: { listingId: string }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { savedListingIds, pendingListingIds, isLoading, loadError, retryLoad, toggleSavedListing } = useSavedListings();
  const [actionError, setActionError] = useState<string | null>(null);
  const className = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-[#141616]/90 px-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#202324] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a6d78f] disabled:cursor-not-allowed disabled:opacity-60";
  if (sessionPending) return <button type="button" disabled aria-label="Checking sign-in status" className={className}>Checking…</button>;
  if (!session?.user) return <Link href="/auth" aria-label="Sign in to save this home" className={className}><span aria-hidden="true">♡</span><span>Sign in to save</span></Link>;
  if (isLoading) return <button type="button" disabled aria-busy="true" className={className}>Loading saved homes…</button>;
  if (loadError) return <div className="flex max-w-56 flex-col items-start gap-1"><button type="button" onClick={retryLoad} className={className}>Retry saved status</button><span role="alert" className="text-xs text-red-200">Saved status could not be loaded.</span></div>;

  const isSaved = savedListingIds.includes(listingId);
  const isPending = pendingListingIds.includes(listingId);
  async function handleClick() {
    setActionError(null);
    try { await toggleSavedListing(listingId); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Your saved homes could not be updated."); }
  }
  return <div className="flex max-w-56 flex-col items-start gap-1">
    <button type="button" aria-pressed={isSaved} aria-label={isSaved ? "Remove from saved homes" : "Save this home"} disabled={isPending} onClick={handleClick} className={className}>
      <span aria-hidden="true">{isSaved ? "♥" : "♡"}</span>
      <span>{isPending ? (isSaved ? "Removing…" : "Saving…") : isSaved ? "Saved" : "Save home"}</span>
    </button>
    {actionError && <span role="alert" className="text-xs text-red-200">{actionError}</span>}
  </div>;
}
