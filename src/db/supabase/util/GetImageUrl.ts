import { supabase } from "@/db/supabase/server";

const getImageUrl = async (id: string, images?: string[]) => {
  const folderPath = `listings/${id}`;

  if (!images) {
    const { data, error } = await supabase.storage
      .from("property-images")
      .list(folderPath);

    if (error) throw error;

    return data.map((file) =>
      supabase.storage
        .from("property-images")
        .getPublicUrl(`${folderPath}/${file.name}`)
        .data.publicUrl
    );
  }

  return images.map((image) =>
    supabase.storage
      .from("property-images")
      .getPublicUrl(`${folderPath}/${image}`)
      .data.publicUrl
  );
};

export default getImageUrl;