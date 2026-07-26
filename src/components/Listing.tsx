

import Link from "next/link";
import { getListingById } from "../db/supabase/util/GetListingById";
import Image from "next/image";

interface ListingProps {
  listing: Houselisting | null;
}
export interface Houselisting {
  id: string;
  images: string[];
  tags: string[];
  title: string;
  price: number;
  stars: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  seller: string;
};


const Listing =  ({listing}: ListingProps) => {

  

  if (!listing) {
    return <div>No listing details found.</div>;
  } 
  if (!listing.images || listing.images.length === 0) {
    return <div>No images available for this property.</div>;
  }


  return (
    <>
        
      
      <Link
        key={listing.id} href={`/listings/${listing.id}`} className="bg-[#202324] block max-w-[25rem]  rounded-lg shadow-md overflow-hidden m-4">
        <div className=" relative w-full aspect-[4/3]">
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            className=" w-full object-cover"
          />
        </div>

        <div className="p-4">
          <h2 className="text-xl font-semibold mb-2">
            {listing.title}
          </h2>

          <span className="text-green-600 font-bold">
            ${listing.price.toLocaleString()}
          </span>

          <p className="text-sm text-black">
            {listing.description}
          </p>
        </div>
      </Link>

    </>
  
)
    
};

export default Listing;
