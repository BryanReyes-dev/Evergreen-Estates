'use client'

import { Houselisting } from "@/components/Listing";



interface ListingProps {
  listings: Houselisting[];
  error: string | null;
  loading: boolean;
 
 
}





const Listing = ({ listings = [] , error, loading }: ListingProps) => {

   
    
   
        
    

   

   

  



   
       

    if (loading) {
        return <div className="flex justify-center items-center h-screen text-[#228000] text-2xl">
            loading...
        </div>
    }

    if (error) {
        console.error(error)
        return <div className="flex justify-center items-center h-screen text-[#228000] text-2xl">
            error: {error}
        </div>
    }

    if (listings.length === 0 ) {
        return <div className="flex justify-center items-center h-screen text-white text-2xl">
            no listings found
        </div>
    }
          
    


   
    return(
        <div className="2xl:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid grid-cols-1 gap-1 justify-center justify-items-center">

            {listings.map((listing: Houselisting) => (

                

                


                <div key={listing.id} className="bg-[#3A3F42]    rounded-lg shadow-md overflow-hidden m-4">
                    <img src={listing.images[0]} alt={listing.title} className="w-full h-48 object-cover"/>
                    <div className="p-4 ">
                        
                        <h2 className="text-xl font-semibold mb-2">{listing.title}</h2>
                        <span className="text-green-600 font-bold mb-2">${listing.price.toLocaleString()}</span>
                        <p className="text-sm text-black font-sans ">{listing.description}</p>
                    
                    </div>
                </div>

                    
                
            ))}
                

        
        </div>
)}

export default Listing;
