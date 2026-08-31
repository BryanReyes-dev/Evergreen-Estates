
import  Houselisting  from "../lib/types";
import {  getListingById } from "../db/supabase/util/GetListingById";
import FeaturedCommunities from "../components/FeaturedCommunities"
import Hero from "../components/Hero"




export interface filters {
    minPrice: number | null;
    maxPrice: number | null;
    tags: string[];
    search: string;

}

const initialFilters: filters = {
    minPrice: null,
    maxPrice: null,
    tags: [],
    search: "",
};

const Home = async () => {

  


  const featuredCommunities_id = ["2efe7c1c-2988-4cbb-8d61-0feced59b0b0", "3843291e-e94b-4ec1-b26e-b191455c8e53", "8fca3710-cda9-4ed4-8dba-113cb686dcaf", "abc12623-5fe6-471e-9683-160b9b4f3fcd", "bfc338aa-93c5-474d-a9dd-d45859a601f5", "dd90c583-f2d0-4276-8e5d-fa424592cdf3"  ]
  const featuredListings = (
  await Promise.all(
    featuredCommunities_id.map((id) => getListingById(id))
  )).filter((listing): listing is Houselisting => listing !== null);



  return (
    <>

      <Hero/>
      
      <div className="flex justify-center w-screen bg-[#141616]">
        <FeaturedCommunities listings={featuredListings}/>
        
      </div>
      
    
    </>


)}

export default Home

