
import { Filters } from "@/components/Filters";
import Listing from "@/components/Listing";
import { Suspense } from "react";
import react from "react";
import {ResultsDisplay} from "@/components/ResultsDisplay";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface SearchParams {
    query?: string;
    price?: string;
    tag?: string[];
}

const Search = async ({searchParams}: {searchParams: Promise<SearchParams>;}) => {

    const params = await searchParams;

    console.log("PAGE PARAMS:", params);
    return (
        <div className="bg-[#141616]"> 
        
         <Filters/>
            <Suspense fallback={<div>Loading page...</div>}>
              
                <ResultsDisplay searchParams={params} />
                
            </Suspense>
        </div>
    );
};

export default Search;
