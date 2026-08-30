

import Link from "next/link";
import Image from "next/image";
import  Houselisting  from "@/lib/types";

export interface ListingProps {
  listing: Pick<
    Houselisting,
    "id" | "images" | "title" | "price" | "description"
  >;
}


const Listing =  ({listing}: ListingProps) => {

  

  
  


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

          <p className="text-sm text-white">
            {listing.description}
          </p>
        </div>
      </Link>

    </>
  
)
    
};

export default Listing;
