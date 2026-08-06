
import { Filters } from "@/components/Filters";
import Listing from "@/components/Listing";
import { Suspense } from "react";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface filters {
    minPrice: number | null;
    maxPrice: number | null;
    tags: string[];
    search: string;
}

const initialFilters: filters = {
    minPrice: null,
    maxPrice: null,
    tags: [],
    search: "",
};

const Search = () => {
    

    

    
   
    return (
        <div className="bg-[#141616]">
            <Suspense fallback={<div>Loading filters...</div>}>
                <Filters/>
                
            </Suspense>
        </div>
    );
};

export default Search;
