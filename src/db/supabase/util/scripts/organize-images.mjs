// src/db/supabase/util/scripts/organize-images.mjs
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — check .env.local"
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const BUCKET = "property-images";

async function main() {
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, images");

  if (error) {
    console.error("Failed to fetch listings:", error);
    return;
  }

  for (const listing of listings) {
    const newImagePaths = [];

    for (const oldPath of listing.images) {
      const filename = oldPath.split("/").pop();
      const newPath = `listings/${listing.id}/${filename}`;

      const { error: moveError } = await supabase.storage
        .from(BUCKET)
        .move(oldPath, newPath);

      if (moveError) {
        console.error(`Failed to move ${oldPath} -> ${newPath}:`, moveError.message);
        continue;
      }

      newImagePaths.push(filename);
      console.log(`Moved ${oldPath} -> ${newPath}`);
    }

    const { error: updateError } = await supabase
      .from("listings")
      .update({ images: newImagePaths })
      .eq("id", listing.id);

    if (updateError) {
      console.error(`Failed to update listing ${listing.id}:`, updateError.message);
    }
  }

  console.log("Done.");
}

main();