import Link from "next/link";

import { getFilteredListings } from "@/db/queries/listings";
import type { SearchParams } from "@/app/types";
import type { DefaultListingSort, ListingViewMode } from "@/lib/account-preferences";
import Listing from "./Listing";

import {
  buildListingPageHref,
  DEFAULT_LISTING_PAGE_SIZE,
  isListingSortValue,
  parseListingPageParam,
} from "@/lib/listing-pagination";
import { MAX_LISTING_PRICE, MIN_LISTING_PRICE } from "@/lib/listing-constants";

function createSearchParams(
  searchParams: SearchParams,
  sort: DefaultListingSort,
): URLSearchParams {
  const params = new URLSearchParams();

  if (searchParams.query) params.set("query", searchParams.query);
  if (searchParams.price) params.set("price", searchParams.price);

  const tags = Array.isArray(searchParams.tag)
    ? searchParams.tag
    : searchParams.tag
      ? [searchParams.tag]
      : [];

  for (const tag of tags) {
    for (const value of tag.split(",")) {
      const normalized = value.trim();
      if (normalized) params.append("tag", normalized);
    }
  }

  params.set("sort", sort);
  return params;
}

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

  const rawTagParams = Array.isArray(searchParams.tag)
    ? searchParams.tag
    : searchParams.tag
      ? [searchParams.tag]
      : [];
  // Accept both repeated params (?tag=garden&tag=garage) and legacy
  // comma-separated params (?tag=garden%2C+garage).
  const parsedTags = rawTagParams
    .flatMap((tag) => tag.split(","))
    .map((tag) => tag.trim())
    .filter(Boolean);

  const filters = {
    price: validPrice,
    tags: parsedTags,
    search: searchParams.query?.trim() || "",
  };

  const sort = isListingSortValue(searchParams.sort)
    ? searchParams.sort
    : defaultSort;
  const pageValue =
    typeof searchParams.page === "string" ? searchParams.page : null;
  const requestedPage = parseListingPageParam(pageValue) ?? 1;
  const result = await getFilteredListings(filters, {
    page: requestedPage,
    pageSize: DEFAULT_LISTING_PAGE_SIZE,
    sort,
  });
  const { listings, pagination } = result;

  if (listings.length === 0) {
    return (
      <div
        aria-live="polite"
        className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-white/65"
      >
        <p>
          No homes match these filters. Try a wider price range or clear one of the selected tags.
        </p>
      </div>
    );
  }

  const containerClass = viewMode === "list"
    ? "mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 p-4"
    : "grid w-full grid-cols-1 gap-4 p-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const firstResult = (pagination.page - 1) * pagination.pageSize + 1;
  const lastResult = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalItems,
  );
  const pageParams = createSearchParams(searchParams, sort);

  return (
    <section aria-label="Property search results" className="w-full">
      <p
        aria-live="polite"
        className="px-4 pt-3 text-sm text-white/60"
      >
        Showing {firstResult}–{lastResult} of {pagination.totalItems} homes
      </p>

      <div className={containerClass} aria-label="Property results">
        {listings.map((listing) => (
          <Listing key={listing.id} listing={listing} />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <nav
          aria-label="Property results pagination"
          className="mx-4 mb-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#202324] px-4 py-3 text-sm text-white sm:flex-row"
        >
          <span className="text-white/65">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <div className="flex items-center gap-2">
            {pagination.hasPreviousPage ? (
              <Link
                href={buildListingPageHref(
                  "/search",
                  pageParams,
                  pagination.page - 1,
                )}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/20 px-4 font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78b75c]"
              >
                Previous
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 px-4 text-white/35"
              >
                Previous
              </span>
            )}

            {pagination.hasNextPage ? (
              <Link
                href={buildListingPageHref(
                  "/search",
                  pageParams,
                  pagination.page + 1,
                )}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#78b75c] px-4 font-semibold text-black hover:bg-[#8bc971] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Next
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 px-4 text-white/35"
              >
                Next
              </span>
            )}
          </div>
        </nav>
      )}
    </section>
  );
};
