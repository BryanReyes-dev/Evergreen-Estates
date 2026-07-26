import { getListingById, Houselisting } from "../db/supabase/util/GetListingById";
import Listing from "./Listing";
import Nav from "./Layout/Nav";
import Image from "next/image";
import Menu from "./Layout/Menu";

interface FeaturedCommunitiesProps {
    listings: Houselisting[]
}



const FeaturedCommunities = ({ listings }: FeaturedCommunitiesProps) => {

    
  return (

    <>


        <div  className="w-full h-full bg-[#141616] text-2xl text-[#228100] ">
        
                
            <div className="flex items-center gap-2 ml-2">


                <Image src={"/images/logo/evergreen_logo.png"} 
                alt="Evergreen Estates Logo"
                width={50}
                height={50}
                unoptimized
                />
                <span className="items-center xs:text-[2rem] mt-1 md:text-4xl  text-2xl font-bold">
                    Featured Communities
                </span>
                <Nav/>

                
            </div>

            <div className="grid grid-cols-1 sml:grid-cols-2 med:grid-cols-3 justify-items-center ">
                {listings.map((listing: Houselisting) => (
                    <Listing
                        key={listing.id}
                        listing={listing}
                    />
                ))}
            </div>
                
                    
                

             
                
    

                
            

            
        </div>

        

    </>

)}

export default FeaturedCommunities;