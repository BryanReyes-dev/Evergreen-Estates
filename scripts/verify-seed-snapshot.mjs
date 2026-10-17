
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const snapshotPath = "seed/snapshots/existing-mock-data.json";
const snapshot = JSON.parse(
  await readFile(snapshotPath, "utf8"),
);

const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};

check(snapshot.listings.length === 6, "Expected 6 listings");
check(snapshot.reviews.length === 3, "Expected 3 reviews");
check(snapshot.users.length === 3, "Expected 3 mock users");
check(snapshot.seller_profiles.length === 0, "Expected 0 seller profiles");
check(snapshot.storage_objects.length === 15, "Expected 15 Storage objects");

const listingIds = new Set(snapshot.listings.map((listing) => listing.id));
const userIds = new Set(snapshot.users.map((user) => user.id));
const objectPaths = new Set(
  snapshot.storage_objects.map((object) => object.path),
);

check(listingIds.size === snapshot.listings.length, "Duplicate listing IDs");
check(userIds.size === snapshot.users.length, "Duplicate mock user IDs");

for (const review of snapshot.reviews) {
  check(
    listingIds.has(review.listing_id),
    `Review ${review.id} references a missing listing`,
  );
  check(
    userIds.has(review.user_id),
    `Review ${review.id} references a missing mock user`,
  );
}

for (const listing of snapshot.listings) {
  check(
    listing.seller_user_id === null,
    `Unexpected owner on listing ${listing.id}; recheck snapshot`,
  );

  for (const filename of listing.media) {
    const expectedPath = `listings/${listing.id}/${filename}`;
    check(
      objectPaths.has(expectedPath),
      `Storage manifest is missing ${expectedPath}`,
    );
  }
}

let verifiedBytes = 0;

for (const object of snapshot.storage_objects) {
  const filePath = path.join(
    "seed",
    "images",
    ...object.path.split("/"),
  );

  try {
    const file = await stat(filePath);

    if (file.size !== object.size_bytes) {
      problems.push(
        `${object.path}: expected ${object.size_bytes} bytes, got ${file.size}`,
      );
    } else {
      verifiedBytes += file.size;
    }
  } catch {
    problems.push(`Missing media file: ${filePath}`);
  }
}

check(
  verifiedBytes === 39998905,
  `Expected 39998905 verified bytes, got ${verifiedBytes}`,
);

console.log(JSON.stringify({
  listings: snapshot.listings.length,
  reviews: snapshot.reviews.length,
  users: snapshot.users.length,
  seller_profiles: snapshot.seller_profiles.length,
  storage_objects: snapshot.storage_objects.length,
  verified_media_bytes: verifiedBytes,
  problems,
}, null, 2));

if (problems.length > 0) {
  process.exitCode = 1;
}

