import { supabase } from '@/db/supabase/server';
import getImageUrl from '@/db/supabase/util/GetMediaUrls'
import {Houselisting} from '@/app/types'


export async function getListingById(id:string): Promise<Houselisting|null> {
  const { data, error } = await supabase
    .from('listings')
    .select("*")
    .eq("id",id)
    .single()
  if (error) {
    console.error('Error fetching listings:',  JSON.stringify(error, null, 2));
    return null;
  }

  
  const listing ={
    ...data,
    images: await getImageUrl(id, data.images)
    
  } 

  
  return listing as Houselisting;
}
