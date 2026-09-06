import { supabase } from '@/db/supabase/server';
import getMediaUrls from '@/db/supabase/util/GetMediaUrls';
import {Houselisting} from '@/app/types'; // Adjust this import path based on where Houselisting is defined
import { filters as Filters } from '@/app/types'; // Adjust this import path based on where filters is defined

export const getFilteredListings = async (filters: Filters): Promise<Houselisting[]> => {
    try {
        // 1. Initialize the base query targeting your 'listings' table
        let query = supabase.from('listings').select('*');

        // 2. Apply Price Range Filter
        if (filters.price !== null) {
            const [minPrice, maxPrice] = filters.price;
            query = query.gte('price', minPrice).lte('price', maxPrice);
        }

        // 3. Apply Text Search (Searches both title and description using an OR condition)
        if (filters.search !== null && filters.search.trim() !== '') {
            const cleanSearch = filters.search.trim();
            query = query.or(`title.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%`);
        }

        // 4. Apply Tags Filter (Matches rows containing ALL requested tags)
        if (filters.tags !== null && filters.tags.length > 0) {
            query = query.contains('tags', filters.tags);
        }

        // 5. Execute the database query
        const { data, error } = await query;

        if (error) {
            console.error('Error executing filtered query:', JSON.stringify(error, null, 2));
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        // 6. Map over all listings and fetch their corresponding image URLs concurrently
        const listingsWithMedia: Houselisting[] = await Promise.all(
            data.map(async (item) => {
                const updatedMedia = await getMediaUrls(item.id, item.media);
                return {
                    ...item,
                    media: updatedMedia
                } as Houselisting;
            })
        );

    return listingsWithMedia;

    } catch (error) {
        console.error('Unhandled exception in getFilteredListings:', error);
        return [];
    }
}
