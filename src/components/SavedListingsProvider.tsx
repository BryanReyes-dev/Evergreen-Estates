"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { readApiData } from "@/lib/api/client";

type SavedListingsResponse = { savedListingIds: string[] };
type SavedListingsContextValue = {
  savedListingIds: string[]; pendingListingIds: string[]; isLoading: boolean; loadError: string | null;
  retryLoad: () => void; toggleSavedListing: (listingId: string) => Promise<boolean>;
};
const SavedListingsContext = createContext<SavedListingsContextValue | null>(null);

export function SavedListingsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user?.id;
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [savedForUserId, setSavedForUserId] = useState<string | null>(null);
  const [pendingListingIds, setPendingListingIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (sessionPending) return;
    let cancelled = false;
    setSavedListingIds([]);
    setSavedForUserId(null);
    if (!userId) {
      setPendingListingIds([]);
      setLoadError(null);
      setIsLoading(false);
      return () => { cancelled = true; };
    }
    setIsLoading(true);
    setLoadError(null);
    async function loadSavedListings() {
      try {
        const result = await readApiData<SavedListingsResponse>(
          await fetch("/api/v1/users/me/saved-listings", { credentials: "same-origin", cache: "no-store" }),
          "Your saved homes could not be loaded.",
        );
        if (!cancelled) {
          setSavedListingIds(result.savedListingIds);
          setSavedForUserId(userId);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Your saved homes could not be loaded. Try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadSavedListings();
    return () => { cancelled = true; };
  }, [sessionPending, userId, loadAttempt]);

  const retryLoad = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);
  const toggleSavedListing = useCallback(async (listingId: string): Promise<boolean> => {
    if (!userId) throw new Error("Sign in to save homes.");
    const shouldSave = !savedListingIds.includes(listingId);
    setPendingListingIds((current) => current.includes(listingId) ? current : [...current, listingId]);
    try {
      const result = await readApiData<SavedListingsResponse>(
        await fetch("/api/v1/users/me/saved-listings", {
          method: "PATCH", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId, saved: shouldSave }),
        }),
        "Your saved homes could not be updated. Try again.",
      );
      if (shouldSave && !result.savedListingIds.includes(listingId)) {
        throw new Error("The listing could not be added to your saved homes.");
      }
      setSavedListingIds((current) => shouldSave
        ? (current.includes(listingId) ? current : [...current, listingId])
        : current.filter((id) => id !== listingId));
      if (!shouldSave) router.refresh();
      return shouldSave;
    } finally {
      setPendingListingIds((current) => current.filter((id) => id !== listingId));
    }
  }, [router, savedListingIds, userId]);

  const visibleSavedListingIds = savedForUserId === userId ? savedListingIds : [];

  return <SavedListingsContext.Provider value={{
    savedListingIds: visibleSavedListingIds,
    pendingListingIds, isLoading, loadError, retryLoad, toggleSavedListing,
  }}>{children}</SavedListingsContext.Provider>;
}
export function useSavedListings() {
  const value = useContext(SavedListingsContext);
  if (!value) throw new Error("useSavedListings must be used within SavedListingsProvider.");
  return value;
}
