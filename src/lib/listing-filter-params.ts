export type ListingFilterParamUpdate =
  | { type: "tags"; tags: readonly string[] }
  | { type: "query"; query: string }
  | { type: "price"; price: string | null }
  | { type: "clear" };

/**
 * Apply one filter change to the latest known URL parameters.
 *
 * Returning a new URLSearchParams instance lets the UI keep a synchronous
 * pending-parameters ref, so rapid changes build on each other instead of
 * each handler reading the last rendered useSearchParams snapshot.
 */
export function updateListingFilterParams(
  current: URLSearchParams,
  update: ListingFilterParamUpdate,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());

  switch (update.type) {
    case "tags": {
      next.delete("tag");
      const uniqueTags = new Set(
        update.tags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      );

      for (const tag of uniqueTags) {
        next.append("tag", tag);
      }
      break;
    }

    case "query": {
      const query = update.query.trim();
      if (query) {
        next.set("query", query);
      } else {
        next.delete("query");
      }
      break;
    }

    case "price": {
      if (update.price) {
        next.set("price", update.price);
      } else {
        next.delete("price");
      }
      break;
    }

    case "clear":
      next.delete("tag");
      next.delete("price");
      next.delete("query");
      break;
  }

  return next;
}

export function buildListingSearchHref(
  pathname: string,
  params: URLSearchParams,
): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
