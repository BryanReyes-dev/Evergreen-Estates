import { supabase } from "@/db/supabase/server";
import getMediaUrls from "@/db/supabase/util/GetMediaUrls";
import { Houselisting } from "@/app/types";

export async function getListingById(id: string): Promise<Houselisting | null> {
  

  const { data, error } = await supabase
  .from("listings")
  .select(`
    *,
    reviews!reviews_listing_id_fkey (
      *,
      user:users (*)
    )
  `)
  .eq("id", id)
  .single();

  if (error) {
    console.error(
      "Error fetching listings:",
      JSON.stringify(error, null, 2)
    );
    return null;
  }

  const listing = {
    ...data,
    media: await getMediaUrls(id, data.media),
  };

  return listing as Houselisting;
}