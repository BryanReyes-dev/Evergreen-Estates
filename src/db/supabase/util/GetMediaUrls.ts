import { supabase } from "@/db/supabase/server";

const getMediaUrl = async (id: string, images: string[] = []) => {
  const folderPath = `listings/${id}`;

  const { data: files, error: listError } = await supabase.storage
    .from("property-images")
    .list(folderPath);

  if (listError) {
    console.error("❌ Error listing media:", listError);
    return [];
  }

  // Files that actually exist in Storage
  const storageFiles = files
    .map((file) => file.name)
    .filter(Boolean);

  // Keep the existing database order,
  // but only for files that still exist in Storage.
  const existingImages = images.filter((image) =>
    storageFiles.includes(image)
  );

  // The database is authoritative: only registered media is served.
  const syncedImages = existingImages;

  const results = await Promise.all(
    syncedImages.map(async (image) => {
      const filePath = `${folderPath}/${image}`;

      const { data, error } = await supabase.storage
        .from("property-images")
        .createSignedUrl(filePath, 60 * 60);

      if (error) {
        console.error("❌ Missing media:", filePath);
        console.error(error);
        return null;
      }

      return data.signedUrl;
    })
  );

  return results.filter(
    (url): url is string => url !== null
  );
};

export default getMediaUrl;