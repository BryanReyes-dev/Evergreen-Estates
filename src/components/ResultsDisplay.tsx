import { getFilteredListings } from "@/db/supabase/util/GetFilteredData";
import { filters, SearchParams } from "@/app/types";
import Listing from "./Listing";

const DEFAULT_PRICE_RANGE: [number, number] = [10_000, 3_000_000];

export const ResultsDisplay = async ({
  searchParams,
}: {
  searchParams: SearchParams;
}) => {
  const price = searchParams.price?.split("-").map(Number);
  const validPrice =
    price?.length === 2 && price.every(Number.isFinite)
      ? (price as [number, number])
      : DEFAULT_PRICE_RANGE;

  const filters: filters = {
    price: validPrice,
    tags: Array.isArray(searchParams.tag)
      ? searchParams.tag
      : searchParams.tag
        ? [searchParams.tag]
        : [],
    search: searchParams.query?.trim() || "",
  };

  const listings = await getFilteredListings(filters);

  if (listings.length === 0) {
    return <div>No listings found.</div>;
  }

  return (
    <div className="grid justify-center gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <Listing key={listing.id} listing={listing} />
      ))}
    </div>
  );
};
