"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { readApiData } from "@/lib/api/client";

type SavedListingsResponse = { savedListingIds: string[] };
type PendingSaveAction = { userId: string; listingId: string };
type SavedListingsContextValue = {
  savedListingIds: string[];
  pendingListingIds: string[];
  isLoading: boolean;
  loadError: string | null;
  retryLoad: () => void;
  toggleSavedListing: (listingId: string) => Promise<boolean>;
};
const SavedListingsContext = createContext<SavedListingsContextValue | null>(null);

export function SavedListingsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user?.id;
  const activeUserIdRef = useRef<string | undefined>(undefined);
  activeUserIdRef.current = userId;

  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [savedForUserId, setSavedForUserId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingSaveAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorForUserId, setLoadErrorForUserId] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (sessionPending) return;
    let cancelled = false;

    setSavedListingIds([]);
    setSavedForUserId(null);
    setLoadError(null);
    setLoadErrorForUserId(null);
    setPendingActions((current) => current.filter((action) => action.userId === userId));

    if (!userId) {
      setPendingActions([]);
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    // Capture the narrowed ID so TypeScript can verify it inside the async closure.
    const requestedUserId = userId;
    setIsLoading(true);
    async function loadSavedListings() {
      try {
        const result = await readApiData<SavedListingsResponse>(
          await fetch("/api/v1/users/me/saved-listings", { credentials: "same-origin", cache: "no-store" }),
          "Your saved homes could not be loaded.",
        );
        if (!cancelled) {
          setSavedListingIds(result.savedListingIds);
          setSavedForUserId(requestedUserId);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Your saved homes could not be loaded. Try again.");
          setLoadErrorForUserId(requestedUserId);
        }
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
    const currentUserSavedIds = savedForUserId === userId ? savedListingIds : [];
    const shouldSave = !currentUserSavedIds.includes(listingId);
    const action = { userId, listingId };
    setPendingActions((current) => current.some((item) => item.userId === userId && item.listingId === listingId)
      ? current
      : [...current, action]);

    try {
      const result = await readApiData<SavedListingsResponse>(
        await fetch("/api/v1/users/me/saved-listings", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId, saved: shouldSave }),
        }),
        "Your saved homes could not be updated. Try again.",
      );

      // A request started for a previous session must never overwrite the next
      // signed-in user's saved state if the account changes before it resolves.
      if (activeUserIdRef.current !== userId) return false;

      if (shouldSave && !result.savedListingIds.includes(listingId)) {
        throw new Error("The listing could not be added to your saved homes.");
      }
      setSavedListingIds(result.savedListingIds);
      setSavedForUserId(userId);
      if (!shouldSave) router.refresh();
      return shouldSave;
    } finally {
      setPendingActions((current) => current.filter((item) => item.userId !== userId || item.listingId !== listingId));
    }
  }, [router, savedForUserId, savedListingIds, userId]);

  const visibleSavedListingIds = savedForUserId === userId ? savedListingIds : [];
  const visibleLoadError = loadErrorForUserId === userId ? loadError : null;
  const isLoadingForCurrentUser = isLoading ||
    (Boolean(userId) && savedForUserId !== userId && loadErrorForUserId !== userId);
  const visiblePendingListingIds = pendingActions
    .filter((action) => action.userId === userId)
    .map((action) => action.listingId);

  return <SavedListingsContext.Provider value={{
    savedListingIds: visibleSavedListingIds,
    pendingListingIds: visiblePendingListingIds,
    isLoading: isLoadingForCurrentUser,
    loadError: visibleLoadError,
    retryLoad,
    toggleSavedListing,
  }}>{children}</SavedListingsContext.Provider>;
}

export function useSavedListings() {
  const value = useContext(SavedListingsContext);
  if (!value) throw new Error("useSavedListings must be used within SavedListingsProvider.");
  return value;
}
