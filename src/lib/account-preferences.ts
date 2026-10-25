export const DEFAULT_ACCOUNT_PREFERENCES = {
  defaultSort: "newest",
  viewMode: "grid",
} as const;

export type DefaultListingSort = "newest" | "price-low" | "price-high";
export type ListingViewMode = "grid" | "list";

export type AccountPreferences = {
  defaultSort: DefaultListingSort;
  viewMode: ListingViewMode;
};

export function normalizeAccountPreferences(value: unknown): AccountPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_ACCOUNT_PREFERENCES;
  }

  const candidate = value as Record<string, unknown>;
  return {
    defaultSort:
      candidate.defaultSort === "price-low" ||
      candidate.defaultSort === "price-high" ||
      candidate.defaultSort === "newest"
        ? candidate.defaultSort
        : DEFAULT_ACCOUNT_PREFERENCES.defaultSort,
    viewMode:
      candidate.viewMode === "list" || candidate.viewMode === "grid"
        ? candidate.viewMode
        : DEFAULT_ACCOUNT_PREFERENCES.viewMode,
  };
}

export function isAccountPreferences(value: unknown): value is AccountPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 2 &&
    Object.keys(candidate).every((key) => key === "defaultSort" || key === "viewMode") &&
    (candidate.defaultSort === "newest" ||
      candidate.defaultSort === "price-low" ||
      candidate.defaultSort === "price-high") &&
    (candidate.viewMode === "grid" || candidate.viewMode === "list")
  );
}
