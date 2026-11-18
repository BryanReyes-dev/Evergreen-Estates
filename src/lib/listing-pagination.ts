import type { DefaultListingSort } from "@/lib/account-preferences";

export const DEFAULT_LISTING_PAGE_SIZE = 12;
export const MAX_LISTING_PAGE_SIZE = 48;
export const MAX_LISTING_PAGE_NUMBER = 10_000;

export type ListingPaginationOptions = {
  page?: number;
  pageSize?: number;
  sort?: DefaultListingSort;
};

export type ListingPaginationInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export function parseListingPageParam(value: string | null): number | null {
  if (value === null) return 1;
  if (!/^[1-9]\\d*$/.test(value)) return null;

  const page = Number(value);
  return Number.isSafeInteger(page) && page <= MAX_LISTING_PAGE_NUMBER
    ? page
    : null;
}

export function parseListingPageSizeParam(value: string | null): number | null {
  if (value === null) return DEFAULT_LISTING_PAGE_SIZE;
  if (!/^[1-9]\\d*$/.test(value)) return null;

  const pageSize = Number(value);
  return Number.isSafeInteger(pageSize) &&
    pageSize <= MAX_LISTING_PAGE_SIZE
    ? pageSize
    : null;
}

export function isListingSortValue(
  value: string | null | undefined,
): value is DefaultListingSort {
  return (
    value === "newest" ||
    value === "price-low" ||
    value === "price-high"
  );
}

export function buildListingPageHref(
  pathname: string,
  currentParams: URLSearchParams,
  page: number,
): string {
  const params = new URLSearchParams(currentParams);

  if (page <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
