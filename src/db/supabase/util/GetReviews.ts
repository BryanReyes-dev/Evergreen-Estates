import { supabase } from "@/db/supabase/server";

export async function getReviewsByListingId(listingId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }

  return data;
}