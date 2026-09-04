import { getListingById } from "@/db/supabase/util/GetListingById";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { HeartIcon } from "@hugeicons/core-free-icons";
import ListingMediaCarousel from "@/components/ListingMediaCarousel";
import { getMediaType } from "@/db/supabase/util/MediaType";



const listingDetails = async ({params}: {params: Promise<{ listingId: string }>;}) => {
  const { listingId } = await params;
  const listing = await getListingById(listingId);

  if (!listing) {
    return <div>No listing details found.</div>;
  }


  
   
  return (
    <div>
      {listing.images.length > 0 ? (
  <Image
    src={listing.images[0]}
    width={1200}
    height={800}
    alt={`${listing.title} Image`}
    className="w-full h-auto [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1),rgba(0,0,0,0))]"
  />
) : (<div className="w-full aspect-[3/2] bg-gray-200" />)}
    <div className=" -0 left-0 flex flex-col justify-end p-2  "> 
      <div className="flex justify-between items-center">
        <HugeiconsIcon size={35}  icon={HeartIcon} />
        <h1 className="text-[1.7rem] font-light flex justify-end text-white ml-2 font-lato bg-inherit">${listing.price.toLocaleString()}</h1>
      </div>
      <h1 className="text-[1.7rem] text-white ml-2 font-maitree bg-inherit">{listing.title}</h1>
      <h1 className="text-[1rem] text-[#474848] ml-2 font-kanit bg-inherit">{listing.address}</h1>
      <p className="text-white p-2">{listing.description}</p>

    </div>

    {listing.images.length > 0 && (
      
    <ListingMediaCarousel
      options={{ loop: true }}
      media={listing.images.map((src) => ({
        
        type: getMediaType(src),
        src
      }))}
    />
    )}
      
    
    </div>
  )
}

export default listingDetails