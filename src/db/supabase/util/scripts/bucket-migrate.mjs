import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OLD_BUCKET = "Property Images";
const NEW_BUCKET = "property-images";


async function migrateFolder(path = "") {
  const { data: files, error } = await supabase.storage
    .from(OLD_BUCKET)
    .list(path);

  if (error) {
    console.error(error);
    return;
  }

  for (const file of files) {
    const filePath = path
      ? `${path}/${file.name}`
      : file.name;


    
    if (!file.metadata) {
      await migrateFolder(filePath);
      continue;
    }


    console.log("Copying:", filePath);


    const { data: downloadData, error: downloadError } =
      await supabase.storage
        .from(OLD_BUCKET)
        .download(filePath);


    if (downloadError) {
      console.error(downloadError);
      continue;
    }


    const { error: uploadError } =
      await supabase.storage
        .from(NEW_BUCKET)
        .upload(
          filePath,
          downloadData,
          {
            upsert: true,
            contentType: file.metadata.mimetype,
          }
        );


    if (uploadError) {
      console.error(uploadError);
    }
  }
}


migrateFolder();