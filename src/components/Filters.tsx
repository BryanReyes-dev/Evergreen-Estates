"use client"
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from 'react'
import { FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    const selectedTags = searchParams.getAll("tag");
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
            const params = new URLSearchParams(searchParams.toString());
            const normalizedTag = tagText.toLowerCase();
            const currentUrlTags = params.getAll('tag');

            if (isChecked) {
                if (!currentUrlTags.includes(normalizedTag)) {
                    params.append('tag', normalizedTag);
                }
            } else {
                params.delete('tag');
                currentUrlTags
                .filter((t) => t !== normalizedTag)
                .forEach((t) => params.append('tag', t));
            }

            router.replace(`${pathname}?${params.toString()}`);
    };

    const handleClearFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('tag');
        params.delete('price');
        params.delete('query');
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
                    {SUPPORTED_LISTING_TAGS.map(tag => ( 
                        <div key={tag} className="flex items-center gap-2" >
                            <Checkbox 
                            className="w-5 h-5" 
                            checked={selectedTags.includes(tag.toLowerCase())}
                            
                            onCheckedChange={(checked) => {handleTagToggle(tag, checked as boolean)}}
                             id={tag}/> 
                            <FieldLabel htmlFor={tag} >
                                {tag}
                            </FieldLabel>
                        </div>
                        
                    ))}
                
                    
                        
                        
                        
                    
                

                

                    <div className="col-span-2 xs:col-span-3 sm:col-span-4 mt-2">
                        <SearchInput
                            key={currentSearchQuery ?? ""}
                            currentSearchQuery={currentSearchQuery}
                            onSearch={handleSearch}
                        />
                    </div>


                    <div className="grid w-full  gap-4 mb-3 mt-0 col-span-2 xs:col-span-3 sm:col-span-4">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="price-channel">Price Range :</Label>
                            <span className="text-sm text-muted-foreground">
                            {formatPrice(value[0])} - {formatPrice(value[1])}
                            </span>
                        </div>
                        <Slider
                            className="text-[#228000] w-full"
                            id="price-channel"
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



