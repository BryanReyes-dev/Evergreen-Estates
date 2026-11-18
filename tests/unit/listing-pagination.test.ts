import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_LISTING_PAGE_SIZE,
  MAX_LISTING_PAGE_SIZE,
  buildListingPageHref,
  isListingSortValue,
  parseListingPageParam,
  parseListingPageSizeParam,
} from "@/lib/listing-pagination";

describe("listing pagination parameters", () => {
  it("uses the default first page and page size", () => {
    expect(parseListingPageParam(null)).toBe(1);
    expect(parseListingPageSizeParam(null)).toBe(DEFAULT_LISTING_PAGE_SIZE);
  });

  it("accepts bounded positive page numbers and page sizes", () => {
    expect(parseListingPageParam("3")).toBe(3);
    expect(parseListingPageSizeParam("24")).toBe(24);
    expect(parseListingPageSizeParam(String(MAX_LISTING_PAGE_SIZE))).toBe(
      MAX_LISTING_PAGE_SIZE,
    );
  });

  it("rejects malformed, zero, unsafe, or out-of-range values", () => {
    expect(parseListingPageParam("0")).toBeNull();
    expect(parseListingPageParam("-1")).toBeNull();
    expect(parseListingPageParam("1.5")).toBeNull();
    expect(parseListingPageParam("10001")).toBeNull();
    expect(parseListingPageSizeParam("0")).toBeNull();
    expect(parseListingPageSizeParam("49")).toBeNull();
    expect(parseListingPageSizeParam("1.5")).toBeNull();
  });

  it("accepts only supported listing sort values", () => {
    expect(isListingSortValue("newest")).toBe(true);
    expect(isListingSortValue("price-low")).toBe(true);
    expect(isListingSortValue("price-high")).toBe(true);
    expect(isListingSortValue("random")).toBe(false);
    expect(isListingSortValue(null)).toBe(false);
  });

  it("preserves all active filters when building a page link", () => {
    const current = new URLSearchParams(
      "tag=garden&tag=garage&query=duplex&price=100000-500000&sort=price-low&page=3",
    );

    expect(buildListingPageHref("/search", current, 4)).toBe(
      "/search?tag=garden&tag=garage&query=duplex&price=100000-500000&sort=price-low&page=4",
    );
  });

  it("removes the page parameter from the first-page link", () => {
    const current = new URLSearchParams("query=duplex&page=3");
    expect(buildListingPageHref("/search", current, 1)).toBe(
      "/search?query=duplex",
    );
  });
});
