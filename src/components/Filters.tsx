"use client";

import { useDebouncedCallback } from "use-debounce";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  MAX_LISTING_PRICE,
  MIN_LISTING_PRICE,
  SUPPORTED_LISTING_TAGS,
} from "@/lib/listing-constants";
import {
  buildListingSearchHref,
  updateListingFilterParams,
  type ListingFilterParamUpdate,
} from "@/lib/listing-filter-params";

type SearchInputProps = {
  currentSearchQuery: string | null;
  onSearch: (term: string) => void;
};

function SearchInput({ currentSearchQuery, onSearch }: SearchInputProps) {
  const [search, setSearch] = useState(currentSearchQuery ?? "");

  return (
    <Input
      className="w-full rounded-lg border-[4px] border-[#228000] bg-transparent text-white"
      type="search"
      placeholder="Search homes..."
      aria-label="Search homes"
      value={search}
      onChange={(event) => {
        const nextSearch = event.target.value;
        setSearch(nextSearch);
        onSearch(nextSearch);
      }}
    />
  );
}

function parsePriceRange(priceRange: string | null): number[] {
  if (!priceRange) return [MIN_LISTING_PRICE, MAX_LISTING_PRICE];

  const parsed = priceRange.split("-").map(Number);
  if (
    parsed.length !== 2 ||
    !parsed.every(Number.isFinite) ||
    parsed[0] > parsed[1]
  ) {
    return [MIN_LISTING_PRICE, MAX_LISTING_PRICE];
  }

  const min = Math.max(MIN_LISTING_PRICE, Math.min(MAX_LISTING_PRICE, parsed[0]));
  const max = Math.max(MIN_LISTING_PRICE, Math.min(MAX_LISTING_PRICE, parsed[1]));
  return min <= max ? [min, max] : [MIN_LISTING_PRICE, MAX_LISTING_PRICE];
}

export const Filters = () => {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const pathname = usePathname();
  const router = useRouter();

  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    searchParams.getAll("tag"),
  );
  const selectedTagsRef = useRef(selectedTags);

  // Treat this ref as the synchronous source of truth for every filter. A click
  // can update it before Next.js has rendered the preceding router navigation.
  const filterParamsRef = useRef(new URLSearchParams(searchParamsString));
  const pendingNavigationRef = useRef(false);
  const pendingParamsStringRef = useRef(searchParamsString);

  // Read display values from the latest intended parameters, not an intermediate
  // useSearchParams snapshot from a navigation that is still settling.
  const currentSearchQuery = filterParamsRef.current.get("query");
  const currentPriceRange = filterParamsRef.current.get("price");

  const navigatePendingFilters = useDebouncedCallback(() => {
    const params = filterParamsRef.current;
    const nextSearch = params.toString();

    pendingNavigationRef.current = true;
    pendingParamsStringRef.current = nextSearch;
    router.replace(buildListingSearchHref(pathname, params), { scroll: false });
  }, 180);

  // External URL changes (including back/forward) hydrate the controls. If an
  // older in-flight navigation lands after a newer interaction, keep the newer
  // pending state and issue the newest URL again instead of reverting the UI.
  useEffect(() => {
    if (pendingNavigationRef.current) {
      if (searchParamsString === pendingParamsStringRef.current) {
        navigatePendingFilters.cancel();
        pendingNavigationRef.current = false;
        filterParamsRef.current = new URLSearchParams(searchParamsString);
        selectedTagsRef.current = filterParamsRef.current.getAll("tag");
      } else {
        navigatePendingFilters();
      }
      return;
    }

    const urlParams = new URLSearchParams(searchParamsString);
    filterParamsRef.current = urlParams;
    pendingParamsStringRef.current = searchParamsString;
    const urlTags = urlParams.getAll("tag");
    selectedTagsRef.current = urlTags;
    setSelectedTags(urlTags);
  }, [navigatePendingFilters, searchParamsString]);

  // Browser history navigation is intentional user input; cancel any pending
  // local filter commit and make the restored URL authoritative.
  useEffect(() => {
    const handlePopState = () => {
      navigatePendingFilters.cancel();

      const urlParams = new URLSearchParams(window.location.search);
      filterParamsRef.current = urlParams;
      pendingParamsStringRef.current = urlParams.toString();
      pendingNavigationRef.current = false;

      const urlTags = urlParams.getAll("tag");
      selectedTagsRef.current = urlTags;
      setSelectedTags(urlTags);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigatePendingFilters]);

  const applyFilterUpdate = useCallback(
    (update: ListingFilterParamUpdate) => {
      const previousSearch = filterParamsRef.current.toString();
      const nextParams = updateListingFilterParams(filterParamsRef.current, update);
      const nextSearch = nextParams.toString();

      filterParamsRef.current = nextParams;
      if (nextSearch === previousSearch) return;

      pendingParamsStringRef.current = nextSearch;
      pendingNavigationRef.current = true;
      navigatePendingFilters();
    },
    [navigatePendingFilters],
  );

  const [priceState, setPriceState] = useState(() => ({
    range: currentPriceRange,
    value: parsePriceRange(currentPriceRange),
  }));

  // Reflect URL changes such as browser back/forward while allowing the slider
  // to respond immediately during a drag.
  if (priceState.range !== currentPriceRange) {
    setPriceState({
      range: currentPriceRange,
      value: parsePriceRange(currentPriceRange),
    });
  }
  const value = priceState.value;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);

  const handlePriceChange = (newValue: number[]) => {
    setPriceState({ range: currentPriceRange, value: newValue });
    applyFilterUpdate({
      type: "price",
      price: `${newValue[0]}-${newValue[1]}`,
    });
  };

  const handleSearch = (term: string) => {
    applyFilterUpdate({ type: "query", query: term });
  };

  const handleTagToggle = (tagText: string, isChecked: boolean) => {
    const normalizedTag = tagText.toLowerCase();
    const currentTags = selectedTagsRef.current;
    const nextTags = isChecked
      ? currentTags.includes(normalizedTag)
        ? currentTags
        : [...currentTags, normalizedTag]
      : currentTags.filter((tag) => tag !== normalizedTag);

    selectedTagsRef.current = nextTags;
    setSelectedTags(nextTags);
    applyFilterUpdate({ type: "tags", tags: nextTags });
  };

  const handleClearFilters = () => {
    selectedTagsRef.current = [];
    setSelectedTags([]);
    applyFilterUpdate({ type: "clear" });
    setPriceState({
      range: currentPriceRange,
      value: [MIN_LISTING_PRICE, MAX_LISTING_PRICE],
    });
  };

  return (
    <section
      aria-label="Home search filters"
      className="m-2 mt-3 rounded-2xl bg-[#202324] text-base text-[#228000]"
    >
      <div className="flex items-center justify-between border-b border-[#228000]">
        <div className="flex w-full items-center justify-center gap-2 px-3">
          <span className="py-2 text-[.9rem] text-white">Tags and Filters</span>
        </div>
        <Button
          type="button"
          onClick={handleClearFilters}
          className="m-0 h-10 rounded-tr-2xl border border-[#228000] bg-[#228000] px-2 py-2 text-[.9rem] text-white"
        >
          Clear Filters
        </Button>
      </div>

      <div
        role="group"
        aria-label="Property features"
        className="grid grid-cols-2 gap-5 p-3 text-[.9rem] xs:grid-cols-3 sm:grid-cols-4"
      >
        {SUPPORTED_LISTING_TAGS.map((tag) => {
          const tagId = `listing-tag-${tag.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;

          return (
            <div key={tag} className="flex items-center gap-2">
              <Checkbox
                className="h-5 w-5"
                checked={selectedTags.includes(tag.toLowerCase())}
                onCheckedChange={(checked) => handleTagToggle(tag, checked === true)}
                id={tagId}
                aria-labelledby={`${tagId}-label`}
              />
              <label
                id={`${tagId}-label`}
                htmlFor={tagId}
                className="cursor-pointer text-sm font-medium leading-none"
              >
                {tag}
              </label>
            </div>
          );
        })}

        <div className="col-span-2 mt-2 xs:col-span-3 sm:col-span-4">
          <SearchInput
            key={currentSearchQuery ?? ""}
            currentSearchQuery={currentSearchQuery}
            onSearch={handleSearch}
          />
        </div>

        <div className="col-span-2 mt-0 mb-3 grid w-full gap-4 xs:col-span-3 sm:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <span id="price-channel-label" className="text-sm font-medium">
              Price Range:
            </span>
            <span className="text-sm text-muted-foreground">
              {formatPrice(value[0])} - {formatPrice(value[1])}
            </span>
          </div>
          <Slider
            className="w-full text-[#228000]"
            id="price-channel"
            aria-labelledby="price-channel-label"
            value={value}
            onValueChange={handlePriceChange}
            min={MIN_LISTING_PRICE}
            max={MAX_LISTING_PRICE}
            step={10_000}
          />
        </div>
      </div>
    </section>
  );
};
