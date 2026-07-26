"use client"
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from 'react'
import { FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"



interface filters {
    minPrice: number | null
    maxPrice: number | null
    tags: string[] | null
    search: string | null

}

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
    const { replace } = useRouter();
    const currentSearchQuery = searchParams.get('query');
    const selectedTags = searchParams.getAll("tags");
    const [search, setSearch] = useState(currentSearchQuery ?? "");



    useEffect(() => {
  setSearch(currentSearchQuery ?? "");
}, [currentSearchQuery]);

    

    const handleSearch = useDebouncedCallback(
        (term: string) => {
            const params = new URLSearchParams(searchParams);

            if (term) {
            params.set("query", term);
            } else {
            params.delete("query");
            }

            replace(`${pathname}?${params.toString()}`);
        },
        300
        );

    const handleTagToggle = (tagText: string, isChecked: boolean) => {
            const params = new URLSearchParams(searchParams.toString());
            const normalizedTag = tagText.toLowerCase();
            const currentUrlTags = params.getAll('tags');

            if (isChecked) {
                if (!currentUrlTags.includes(normalizedTag)) {
                    params.append('tags', normalizedTag);
                }
            } else {
                params.delete('tags');
                currentUrlTags
                .filter((t) => t !== normalizedTag)
                .forEach((t) => params.append('tags', t));
            }

            replace(`${pathname}?${params.toString()}`);
    };


  return (
    <div className="text-[#228000] m-2 mt-3 rounded-2xl bg-[#202324] text-base">
                <span className="ml-3">Tags and Filters</span>


                

                <form  className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-5 p-3 text-[.9rem]">
                    {tags.map(tag => ( 
                        <div key={tag} className="flex items-center gap-2" >
                            <Checkbox 
                            className="w-5 h-5" 
                            checked={selectedTags.includes(tag.toLowerCase())}
                            
                            onCheckedChange={(checked) => {handleTagToggle(tag, checked === true )}}
                             id={tag}/> 
                            <FieldLabel htmlFor={tag} >
                                {tag}
                            </FieldLabel>
                        </div>
                        
                    ))}
                
                    
                        
                        
                        
                    
                

                

                    <div className="col-span-2 xs:col-span-3 sm:col-span-4 mt-2">
                        <Input
                        type='search'
                        placeholder="Search homes..."
                        onChange={(e) => {
                        setSearch(e.target.value);
                        handleSearch(e.target.value);
                        }}



                        />
                    </div>
                </form>
                    
            </div>
  )
}



