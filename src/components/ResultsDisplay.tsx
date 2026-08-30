
import { getFilteredListings } from '@/db/supabase/util/GetFilteredData';
import { filters } from '@/components/types/filters';
import Listing from './Listing';




interface SearchParams {
    query?: string;
    price?: string;
    tag?: string | string[];
};


interface ResultsDisplayProps {
    searchParams: SearchParams;
}

export const ResultsDisplay = async ({
    searchParams,
}: ResultsDisplayProps) => {

    const filters: filters = {
        price: searchParams.price
            ? searchParams.price.split('-').map(Number) as [number, number]
            : [100000, 5000000],

        tags: Array.isArray(searchParams.tag)
        ? searchParams.tag
        : searchParams.tag
        ? [searchParams.tag]
        : [],

        search: searchParams.query || ''
    };


    const listings = await  getFilteredListings(filters);{
        if (listings.length === 0) {
            return <div>No listings found.</div>;
        }
 
    }
 

    return (
        <div className="  grid justify-center sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">

            {listings.map(listing => (
                <Listing
                    key={listing.id}
                    listing={listing}
                    
                />
            ))}

        </div>
    )
}