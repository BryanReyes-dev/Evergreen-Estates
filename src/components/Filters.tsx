"use client"
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from 'react'
import { FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button, buttonVariants } from './ui/button';






const tags = [
"Swimming Pool",
"Garage",
"Basement",
"Attic",
"Fireplace",
"Garden",
"Balcony",
"Patio",
"Air Conditioning",
"Heating System",
"Hardwood Floors",
"Carpeted Floors"]






export const Filters =() => {

    
    const searchParams = useSearchParams();
    const pathname = usePathname();
    
    const currentSearchQuery = searchParams.get('query');
    const selectedTags = searchParams.getAll("tag");
    const [search, setSearch] = useState(currentSearchQuery ?? "");
    const router = useRouter();



    const [value, setValue] = useState([10000, 3000000])


    useEffect(() => {
        if (currentSearchQuery !== null) {
            setSearch(currentSearchQuery);
        }
    }, [currentSearchQuery]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(price);};

   const handlePriceChange = (newValue: number[]) => {
    setValue(newValue);
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
        setValue([10000, 3000000]);
        setSearch("");
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
                    {tags.map(tag => ( 
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
                        <Input
                        className="w-full border-[4px] rounded-lg text-white bg-transparent border-[#228000]   "
                        type='search'
                        placeholder="Search homes..."
                        value={search}
                        onChange={(e) => {
                        setSearch(e.target.value);
                        handleSearch(e.target.value);
                        }}



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
                            min={10000}
                            max={3000000}
                            step={10000}
                        />
                        </div>
                    
                </form>
                    
            </div>
  )
}



