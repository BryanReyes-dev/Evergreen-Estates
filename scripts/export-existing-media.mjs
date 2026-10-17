
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import {
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const mediaRoot = path.join(projectRoot, "seed", "images");
const envPath = path.join(projectRoot, ".env");
const overwrite = process.argv.includes("--overwrite");

dotenv.config({ path: envPath });

// Verified inventory from the existing private Supabase bucket.
// Sizes are checked before files are saved.
const objects = [
  { name: "home-image.jpg", size_bytes: 392916 },
  {
    name: "listings/2efe7c1c-2988-4cbb-8d61-0feced59b0b0/homes-and-land-virtual-tour (1).gif",
    size_bytes: 11091843,
  },
  {
    name: "listings/2efe7c1c-2988-4cbb-8d61-0feced59b0b0/house1-tour.mp4",
    size_bytes: 14962552,
  },
  {
    name: "listings/2efe7c1c-2988-4cbb-8d61-0feced59b0b0/house1.jpg",
    size_bytes: 2283440,
  },
  {
    name: "listings/2efe7c1c-2988-4cbb-8d61-0feced59b0b0/houseinterior1.jpg",
    size_bytes: 1587710,
  },
  {
    name: "listings/3843291e-e94b-4ec1-b26e-b191455c8e53/house2.jpg",
    size_bytes: 2416589,
  },
  {
    name: "listings/3843291e-e94b-4ec1-b26e-b191455c8e53/houseinterior2.jpg",
    size_bytes: 309659,
  },
  {
    name: "listings/8fca3710-cda9-4ed4-8dba-113cb686dcaf/house3.jpg",
    size_bytes: 1161368,
  },
  {
    name: "listings/8fca3710-cda9-4ed4-8dba-113cb686dcaf/houseinterior3.jpg",
    size_bytes: 749008,
  },
  {
    name: "listings/abc12623-5fe6-471e-9683-160b9b4f3fcd/house4.jpg",
    size_bytes: 1833740,
  },
  {
    name: "listings/abc12623-5fe6-471e-9683-160b9b4f3fcd/houseinterior4.jpg",
    size_bytes: 1030156,
  },
  {
    name: "listings/bfc338aa-93c5-474d-a9dd-d45859a601f5/house5.jpg",
    size_bytes: 1397550,
  },
  {
    name: "listings/bfc338aa-93c5-474d-a9dd-d45859a601f5/houseinterior5.jpg",
    size_bytes: 309659,
  },
  {
    name: "listings/dd90c583-f2d0-4276-8e5d-fa424592cdf3/house6.jpg",
    size_bytes: 53541,
  },
  {
    name: "listings/dd90c583-f2d0-4276-8e5d-fa424592cdf3/houseinterior6.jpg",
    size_bytes: 419174,
  },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `Missing Supabase URL or anon key in ${envPath}.`,
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

await mkdir(mediaRoot, { recursive: true });

let downloaded = 0;
let skipped = 0;
let totalBytes = 0;

for (const object of objects) {
  const segments = object.name.split("/");

  if (
    object.name.length === 0 ||
    path.posix.isAbsolute(object.name) ||
    segments.includes("..")
  ) {
    throw new Error(`Unsafe Storage path: ${object.name}`);
  }

  const destination = path.resolve(mediaRoot, ...segments);
  const rootWithSeparator = `${path.resolve(mediaRoot)}${path.sep}`;

  if (!destination.startsWith(rootWithSeparator)) {
    throw new Error(`Path escapes seed/images: ${object.name}`);
  }

  try {
    const existing = await stat(destination);

    if (existing.size === object.size_bytes && !overwrite) {
      console.log(`SKIP ${object.name} (already verified by size)`);
      skipped++;
      totalBytes += existing.size;
      continue;
    }

    if (!overwrite) {
      throw new Error(
        `Existing file has the wrong size: ${object.name}. Review it before using --overwrite.`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      !("code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }

  const { data, error } = await supabase.storage
    .from("property-images")
    .download(object.name);

  if (error || !data) {
    throw new Error(
      `Could not download ${object.name}: ${
        error?.message ?? "No data returned"
      }`,
    );
  }

  const bytes = Buffer.from(await data.arrayBuffer());

  if (bytes.byteLength !== object.size_bytes) {
    throw new Error(
      `Size mismatch for ${object.name}: expected ${object.size_bytes}, got ${bytes.byteLength}.`,
    );
  }

  await mkdir(path.dirname(destination), { recursive: true });

  const temporaryPath = `${destination}.download-${process.pid}.tmp`;
  await writeFile(temporaryPath, bytes);

  if (overwrite) {
    const existing = await stat(destination).catch(() => null);
    if (existing) {
      const { unlink } = await import("node:fs/promises");
      await unlink(destination);
    }
  }

  await rename(temporaryPath, destination);

  console.log(`OK   ${object.name} (${bytes.byteLength} bytes)`);
  downloaded++;
  totalBytes += bytes.byteLength;
}

console.log(
  `\nExport complete: ${downloaded} downloaded, ${skipped} skipped, ${objects.length} total.`,
);
console.log(`Verified bytes: ${totalBytes}`);
console.log(`Destination: ${path.relative(projectRoot, mediaRoot)}`);
