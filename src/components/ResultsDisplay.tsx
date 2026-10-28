import { getFilteredListings } from "@/db/queries/listings";
import type { SearchParams } from "@/app/types";
import type { DefaultListingSort, ListingViewMode } from "@/lib/account-preferences";
import Listing from "./Listing";

import { MAX_LISTING_PRICE, MIN_LISTING_PRICE } from "@/lib/listing-constants";

export const ResultsDisplay = async ({
  searchParams,
  defaultSort = "newest",
  viewMode = "grid",
}: {
  searchParams: SearchParams;
  defaultSort?: DefaultListingSort;
  viewMode?: ListingViewMode;
}) => {
  const price = searchParams.price?.split("-").map(Number);
  const validPrice =
    price?.length === 2 &&
    price.every(Number.isFinite) &&
    price[0] <= price[1]
      ? (price as [number, number])
      : [MIN_LISTING_PRICE, MAX_LISTING_PRICE] as [number, number];

  const filters = {
    price: validPrice,
    tags: Array.isArray(searchParams.tag)
      ? searchParams.tag
      : searchParams.tag
        ? [searchParams.tag]
        : [],
    search: searchParams.query?.trim() || "",
  };

  const debugToken = process.env.LISTING_FILTER_DEBUG_TOKEN;
  const showFilterDebug = Boolean(debugToken && searchParams.debug === debugToken);
  const debugInfo: { query?: { sql: string; params: unknown[] } } = {};
  const listings = await getFilteredListings(
    filters,
    showFilterDebug
      ? (query) => {
          debugInfo.query = query;
          console.error("[listing-filter-debug]", JSON.stringify(query));
        }
      : undefined,
  );
  const rawSort = searchParams.sort;
  const sort: DefaultListingSort =
    rawSort === "price-low" || rawSort === "price-high" || rawSort === "newest"
      ? rawSort
      : defaultSort;
  const sortedListings = [...listings].sort((left, right) => {
    if (sort === "price-low") return left.price - right.price;
    if (sort === "price-high") return right.price - left.price;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  if (sortedListings.length === 0) {
    return (
      <div aria-live="polite" className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-white/65">
        <p>No homes match these filters. Try a wider price range or clear one of the selected tags.</p>
        {showFilterDebug && debugInfo.query ? (
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded bg-black/20 p-3 text-xs text-white/80">
            {JSON.stringify(debugInfo.query, null, 2)}
          </pre>
        ) : null}
      </div>
    );
  }

  const containerClass = viewMode === "list"
    ? "mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 p-4"
    : "grid w-full grid-cols-1 gap-4 p-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={containerClass} aria-label="Property results">
      {sortedListings.map((listing) => (
        <Listing key={listing.id} listing={listing} />
      ))}
    </div>
  );
};
