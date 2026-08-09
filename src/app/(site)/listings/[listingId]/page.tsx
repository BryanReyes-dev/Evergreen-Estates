import { getListingById } from "@/db/supabase/util/GetListingById";
import Image from "next/image";

const listingDetails = async ({params}: {params: Promise<{ listingId: string }>;}) => {
  const { listingId } = await params;
  const listing = await getListingById(listingId);

  if (!listing) {
    return <div>No listing details found.</div>;
  }
  return (
    <div>
        <Image
        src={listing.images[0]} 
        width={1200}
        height={800}
        alt={`${listing.title} Image`}
        className="w-full h-auto [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1),rgba(0,0,0,0))]" />
      
      <h1 className="text-lg ml-2 font-semibold bg-inherit">{listing.title}</h1>
    
    </div>
  )
}

export default listingDetails