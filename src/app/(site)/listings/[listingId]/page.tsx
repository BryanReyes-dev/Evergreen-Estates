import { getListingById } from "@/db/supabase/util/GetListingById";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { HeartIcon } from "@hugeicons/core-free-icons";


const listingDetails = async ({params}: {params: Promise<{ listingId: string }>;}) => {
  const { listingId } = await params;
  const listing = await getListingById(listingId);

  if (!listing) {
    return <div>No listing details found.</div>;
  }
  return (
    <div>
      <Image src={listing.images[0]} 
        width={1200}
        height={800}
        alt={`${listing.title} Image`}
        className="w-full h-auto [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1),rgba(0,0,0,0))]" 
      />
      <div> 
        <HugeiconsIcon size={35} className="absolute" icon={HeartIcon} />
        <h1 className="text-[1.7rem] font-light flex justify-end text-white ml-2 font-lato bg-inherit">${listing.price.toLocaleString()}</h1>
        <h1 className="text-[1.7rem] text-white ml-2 font-maitree bg-inherit">{listing.title}</h1>
        <h1 className="text-[1rem] text-[#474848] ml-2 font-kanit bg-inherit">{listing.address}</h1>
        <p className="text-white p-2">{listing.description}</p>

      </div>
     
      
    
    </div>
  )
}

export default listingDetails