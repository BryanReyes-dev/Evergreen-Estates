import { describe, expect, it } from "vite-plus/test";

import {
  buildListingSearchHref,
  updateListingFilterParams,
} from "@/lib/listing-filter-params";

describe("listing filter URL parameter updates", () => {
  it("accumulates multiple selected tags and removes duplicates", () => {
    let params = new URLSearchParams("sort=price-low");
    params = updateListingFilterParams(params, {
      type: "tags",
      tags: ["Garden"],
    });
    params = updateListingFilterParams(params, {
      type: "tags",
      tags: ["garden", "Garage", "garden"],
    });

    expect(params.getAll("tag")).toEqual(["garden", "garage"]);
    expect(params.get("sort")).toBe("price-low");
  });

  it("removes only the unchecked tag and preserves other filters", () => {
    const initial = new URLSearchParams(
      "tag=garden&tag=garage&query=duplex&price=100000-500000&sort=newest",
    );
    const params = updateListingFilterParams(initial, {
      type: "tags",
      tags: ["garden"],
    });

    expect(params.getAll("tag")).toEqual(["garden"]);
    expect(params.get("query")).toBe("duplex");
    expect(params.get("price")).toBe("100000-500000");
    expect(params.get("sort")).toBe("newest");
  });

  it("preserves pending tags and price when the search text changes", () => {
    const params = updateListingFilterParams(
      new URLSearchParams("tag=garden&tag=garage&price=100000-500000"),
      { type: "query", query: "  duplex  " },
    );

    expect(params.getAll("tag")).toEqual(["garden", "garage"]);
    expect(params.get("query")).toBe("duplex");
    expect(params.get("price")).toBe("100000-500000");
  });

  it("removes a blank query without dropping tags or price", () => {
    const params = updateListingFilterParams(
      new URLSearchParams(
        "tag=garden&tag=garage&query=duplex&price=100000-500000",
      ),
      { type: "query", query: "   " },
    );

    expect(params.getAll("tag")).toEqual(["garden", "garage"]);
    expect(params.has("query")).toBe(false);
    expect(params.get("price")).toBe("100000-500000");
  });

  it("preserves tags and search while changing or resetting the price", () => {
    const params = updateListingFilterParams(
      new URLSearchParams("tag=garden&tag=garage&query=duplex"),
      { type: "price", price: "200000-600000" },
    );

    expect(params.getAll("tag")).toEqual(["garden", "garage"]);
    expect(params.get("query")).toBe("duplex");
    expect(params.get("price")).toBe("200000-600000");

    const reset = updateListingFilterParams(params, {
      type: "price",
      price: null,
    });
    expect(reset.has("price")).toBe(false);
    expect(reset.getAll("tag")).toEqual(["garden", "garage"]);
    expect(reset.get("query")).toBe("duplex");
  });

  it("clears search filters but preserves unrelated URL state", () => {
    const params = updateListingFilterParams(
      new URLSearchParams(
        "tag=garden&tag=garage&query=duplex&price=100000-500000&sort=price-low",
      ),
      { type: "clear" },
    );

    expect(params.has("tag")).toBe(false);
    expect(params.has("query")).toBe(false);
    expect(params.has("price")).toBe(false);
    expect(params.get("sort")).toBe("price-low");
  });

  it("builds a clean path when no query parameters remain", () => {
    expect(buildListingSearchHref("/search", new URLSearchParams())).toBe(
      "/search",
    );
    expect(
      buildListingSearchHref(
        "/search",
        new URLSearchParams("tag=garden&tag=garage"),
      ),
    ).toBe("/search?tag=garden&tag=garage");
  });
});
