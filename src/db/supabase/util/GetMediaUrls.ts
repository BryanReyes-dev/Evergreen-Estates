import "server-only";

import { getListingMediaUrls } from "@/db/supabase/storage-admin";

const getMediaUrls = async (
  id: string,
  images: string[] = [],
): Promise<string[]> => {
  return getListingMediaUrls({
    listingId: id,
    filenames: images,
  });
};

export default getMediaUrls;