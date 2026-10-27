"use client"
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox"
import { useEffect, useRef, useState } from 'react'
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Button } from './ui/button';
import { MAX_LISTING_PRICE, MIN_LISTING_PRICE, SUPPORTED_LISTING_TAGS } from "@/lib/listing-constants";






type SearchInputProps = {
    currentSearchQuery: string | null;
    onSearch: (term: string) => void;
};

function SearchInput({ currentSearchQuery, onSearch }: SearchInputProps) {
    const [search, setSearch] = useState(currentSearchQuery ?? "");

    return (
        <Input
            className="w-full border-[4px] rounded-lg text-white bg-transparent border-[#228000]"
            type="search"
            placeholder="Search homes..."
            value={search}
            onChange={(event) => {
                setSearch(event.target.value);
                onSearch(event.target.value);
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

export const Filters =() => {

    
    const searchParams = useSearchParams();
    const pathname = usePathname();
    
    const currentSearchQuery = searchParams.get('query');
    const currentPriceRange = searchParams.get("price");
    const [selectedTags, setSelectedTags] = useState<string[]>(() => searchParams.getAll("tag"));
    const selectedTagsRef = useRef(selectedTags);
    const pendingTagNavigationRef = useRef(false);

    // Keep optimistic checkbox state during rapid URL navigations. Ignore intermediate
    // URL states until the latest requested tag selection has arrived.
    useEffect(() => {
        const urlTags = searchParams.getAll("tag");

        if (pendingTagNavigationRef.current) {
            if (
                urlTags.length === selectedTagsRef.current.length &&
                urlTags.every((tag, index) => tag === selectedTagsRef.current[index])
            ) {
                pendingTagNavigationRef.current = false;
            }
            return;
        }

        selectedTagsRef.current = urlTags;
        setSelectedTags(urlTags);
    }, [searchParams]);
    const router = useRouter();



    const [priceState, setPriceState] = useState(() => ({
        range: currentPriceRange,
        value: parsePriceRange(currentPriceRange),
    }));

    // Reset from URL changes (including browser back/forward) without syncing state in an effect.
    if (priceState.range !== currentPriceRange) {
        setPriceState({
            range: currentPriceRange,
            value: parsePriceRange(currentPriceRange),
        });
    }
    const value = priceState.value;


  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(price);};

   const handlePriceChange = (newValue: number[]) => {
    setPriceState({ range: currentPriceRange, value: newValue });
    updatePriceURL(newValue);
    };
   
    const updatePriceURL = useDebouncedCallback(
  (newValue: number[]) => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("price", `${newValue[0]}-${newValue[1]}`);

    router.replace(`${pathname}?${params.toString()}`);
  },
  300
);

    const handleSearch = useDebouncedCallback(
        (term: string) => {
            const params = new URLSearchParams(searchParams.toString());

            if (term) {
            params.set("query", term);
            } else {
            params.delete("query");
            }

            router.replace(`${pathname}?${params.toString()}`);
        },
        300
    );

    const handleTagToggle = (tagText: string, isChecked: boolean) => {
        const normalizedTag = tagText.toLowerCase();
        const currentTags = selectedTagsRef.current;
        const nextTags = isChecked
            ? currentTags.includes(normalizedTag)
                ? currentTags
                : [...currentTags, normalizedTag]
            : currentTags.filter((tag) => tag !== normalizedTag);

        // Update the source of truth synchronously so consecutive clicks build on
        // each other instead of the last URL that Next.js has finished rendering.
        selectedTagsRef.current = nextTags;
        pendingTagNavigationRef.current = true;
        setSelectedTags(nextTags);

        const params = new URLSearchParams(searchParams.toString());
        params.delete("tag");
        nextTags.forEach((tag) => params.append("tag", tag));

        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleClearFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('tag');
        params.delete('price');
        params.delete('query');

        selectedTagsRef.current = [];
        pendingTagNavigationRef.current = true;
        setSelectedTags([]);

        router.replace(`${pathname}?${params.toString()}`);
        setPriceState({ range: currentPriceRange, value: [MIN_LISTING_PRICE, MAX_LISTING_PRICE] });
    }


  return (
    <div className="text-[#228000] m-2 mt-3 rounded-2xl bg-[#202324] text-base">
            <div className="flex items-center justify-between  border-b border-[#228000]">
                <div className="flex mx-3  justify-center items-center w-full gap-2">
                    <span className="  m-0 text-white px-2   py-2  text-[.9rem]">
                        Tags and Filters
                    </span>
                </div>
                <Button onClick={handleClearFilters} className="bg-[#228000] m-0 h-10 border border-[#228000] text-white px-2 py-2 rounded-tr-2xl text-[.9rem]"  >
                    Clear Filters
                </Button>
            </div>

                

                <form  className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-5 p-3 text-[.9rem]">
                    {SUPPORTED_LISTING_TAGS.map((tag) => {
                        const tagId = `listing-tag-${tag.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;

                        return (
                            <div key={tag} className="flex items-center gap-2">
                                <Checkbox
                                    className="w-5 h-5"
                                    checked={selectedTags.includes(tag.toLowerCase())}
                                    onCheckedChange={(checked) => {
                                        handleTagToggle(tag, checked as boolean);
                                    }}
                                    id={tagId}
                                    aria-labelledby={`${tagId}-label`}
                                />
                                <span
                                    id={`${tagId}-label`}
                                    className="text-sm font-medium leading-none"
                                >
                                    {tag}
                                </span>
                            </div>
                        );
                    })}
                
                    
                        
                        
                        
                    
                

                

                    <div className="col-span-2 xs:col-span-3 sm:col-span-4 mt-2">
                        <SearchInput
                            key={currentSearchQuery ?? ""}
                            currentSearchQuery={currentSearchQuery}
                            onSearch={handleSearch}
                        />
                    </div>


                    <div className="grid w-full  gap-4 mb-3 mt-0 col-span-2 xs:col-span-3 sm:col-span-4">
                        <div className="flex items-center justify-between gap-2">
                            <span id="price-channel-label" className="text-sm font-medium">Price Range :</span>
                            <span className="text-sm text-muted-foreground">
                            {formatPrice(value[0])} - {formatPrice(value[1])}
                            </span>
                        </div>
                        <Slider
                            className="text-[#228000] w-full"
                            id="price-channel"
                            aria-labelledby="price-channel-label"
                            value={value}
                            onValueChange={(value) => handlePriceChange(value as number[])}
                            min={MIN_LISTING_PRICE}
                            max={MAX_LISTING_PRICE}
                            step={10000}
                        />
                        </div>
                    
                </form>
                    
            </div>
  )
}



