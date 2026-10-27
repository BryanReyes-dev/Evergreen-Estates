import { SUPPORTED_LISTING_TAG_VALUES } from "@/lib/listing-constants";

export type ListingFilterParamUpdate =
  | { type: "tags"; tags: readonly string[] }
  | { type: "query"; query: string }
  | { type: "price"; price: string | null }
  | { type: "clear" };

const supportedTags = new Set<string>(SUPPORTED_LISTING_TAG_VALUES);

export function normalizeListingTags(tags: readonly string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => supportedTags.has(tag)),
    ),
  ];
}

export function toggleListingTag(
  currentTags: readonly string[],
  tag: string,
  isChecked: boolean,
): string[] {
  const normalizedTags = normalizeListingTags(currentTags);
  const normalizedTag = tag.trim().toLowerCase();

  if (!supportedTags.has(normalizedTag)) return normalizedTags;

  if (isChecked) {
    return normalizedTags.includes(normalizedTag)
      ? normalizedTags
      : [...normalizedTags, normalizedTag];
  }

  return normalizedTags.filter((selectedTag) => selectedTag !== normalizedTag);
}

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
      for (const tag of normalizeListingTags(update.tags)) {
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
