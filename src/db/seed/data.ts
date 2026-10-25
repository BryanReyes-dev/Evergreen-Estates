/**
 * Evergreen Estates intended seed dataset.
 *
 * This file defines mock data, not database operations.
 * Seller user IDs will be resolved when the future population process
 * provisions their Better Auth accounts.
 *
 * Keep seed/snapshots/existing-mock-data.json unchanged. That file is
 * the historical record of the old database state.
 */

export type ContactMethod = "email" | "phone";

export interface SeedSeller {
  key: string;
  name: string;
  email: string;
  profile: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    preferredContactMethod: ContactMethod;
    isPublished: boolean;
  };
}

/**
 * These are login-capable mock sellers.
 *
 * The future population process must provision their accounts through
 * Better Auth. Do not add passwords or password hashes here.
 */
export const seedSellers = [
  {
    key: "daniel",
    name: "Daniel Carter",
    email: "daniel.carter@example.com",
    profile: {
      displayName: "Carter Realty",
      bio: "Residential properties selected for comfort, practical layouts, and long-term value.",
      avatarUrl: null,
      contactEmail: "sales@carterrealty.example",
      contactPhone: null,
      preferredContactMethod: "email",
      isPublished: true,
    },
  },
  {
    key: "maya",
    name: "Maya Thompson",
    email: "maya.thompson@example.com",
    profile: {
      displayName: "Thompson Homes",
      bio: "Helping people discover thoughtfully designed homes in established neighborhoods.",
      avatarUrl: null,
      contactEmail: null,
      contactPhone: "615-555-0142",
      preferredContactMethod: "phone",
      isPublished: true,
    },
  },
  {
    key: "jordan",
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    profile: {
      displayName: "Jordan Lee Properties",
      bio: "A collection of urban homes, practical starter properties, and distinctive residences.",
      avatarUrl: null,
      contactEmail: "hello@jordanleeproperties.example",
      contactPhone: null,
      preferredContactMethod: "email",
      isPublished: true,
    },
  },
  {
    key: "priya",
    name: "Priya Patel",
    email: "priya.patel@example.com",
    profile: {
      displayName: "Patel Residential",
      bio: "Residential listings focused on useful amenities, location, and livable spaces.",
      avatarUrl: null,
      contactEmail: null,
      contactPhone: "828-555-0167",
      preferredContactMethod: "phone",
      isPublished: true,
    },
  },
] as const satisfies readonly SeedSeller[];

export type SeedSellerKey = (typeof seedSellers)[number]["key"];

export type SeedReviewerKey = SeedSellerKey;

/**
 * The sellerKey is a fixture reference, not a database column.
 *
 * The future population process resolves it to the user's actual UUID
 * and writes that UUID into listings.seller_user_id.
 */
export interface SeedListing {
  id: string;
  sellerKey: SeedSellerKey;
  media: string[];
  tags: string[];
  title: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * First six listings preserve their archived IDs, details, and original
 * photo names. The six additional listings use stable IDs and their assigned
 * media assets for repeatable seeding.
 */
export const seedListings = [
  {
    id: "2efe7c1c-2988-4cbb-8d61-0feced59b0b0",
    sellerKey: "daniel",
    media: [
      "house1.jpg",
      "houseinterior1.jpg",
      "homes-and-land-virtual-tour (1).gif",
      "house1-tour.mp4",
    ],
    tags: ["swimming pool", "garden", "garage"],
    title: "Modern Luxury Villa",
    price: 850000,
    beds: 5,
    baths: 4,
    sqft: 4200,
    address: "12 Beverly Hills Dr, Los Angeles, CA",
    description:
      "A stunning luxury villa featuring a private pool, open-concept living space, and panoramic city views.",
    createdAt: "2026-07-24T20:18:49.529195+00:00",
    updatedAt: "2026-10-11T18:25:07.202118+00:00",
  },
  {
    id: "3843291e-e94b-4ec1-b26e-b191455c8e53",
    sellerKey: "daniel",
    media: [
      "house2.jpg",
      "houseinterior2.jpg",
      "ezgif-41b8278b3e41a3cc.gif",
      "4301618-hd_1920_1080_30fps.mp4",
    ],
    tags: ["garden", "fireplace", "garage"],
    title: "Private Country Estate",
    price: 1200000,
    beds: 6,
    baths: 5,
    sqft: 6000,
    address: "990 Countryside Rd, Nashville, TN",
    description:
      "Expansive estate with large land, fireplace, garden, and garage.",
    createdAt: "2026-07-24T20:18:49.529195+00:00",
    updatedAt: "2026-10-11T18:25:07.202118+00:00",
  },
  {
    id: "8fca3710-cda9-4ed4-8dba-113cb686dcaf",
    sellerKey: "maya",
    media: [
      "house3.jpg",
      "houseinterior3.jpg",
      "ezgif-49fb9833472a2f2b.gif",
      "15694639_1080_1920_30fps.mp4",
    ],
    tags: ["fireplace", "hardwood floors", "garden"],
    title: "Cozy Suburban Family Home",
    price: 410000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    address: "88 Maplewood Ln, Austin, TX",
    description:
      "Warm family home with fireplace, hardwood floors, and large backyard.",
    createdAt: "2026-07-24T20:18:49.529195+00:00",
    updatedAt: "2026-10-11T18:25:07.202118+00:00",
  },
  {
    id: "abc12623-5fe6-471e-9683-160b9b4f3fcd",
    sellerKey: "maya",
    media: [
      "house4.jpg",
      "houseinterior4.jpg",
      "ezgif-4e8fdbdd9bc1dfc3.gif",
      "4301615-hd_1920_1080_30fps.mp4",
    ],
    tags: ["garage", "attic", "hardwood floors"],
    title: "Modern Townhouse with Garage",
    price: 520000,
    beds: 3,
    baths: 3,
    sqft: 2100,
    address: "77 Pinecrest Ave, Seattle, WA",
    description:
      "Smart townhouse with garage, attic space, and hardwood floors.",
    createdAt: "2026-07-24T20:18:49.529195+00:00",
    updatedAt: "2026-10-11T18:25:07.202118+00:00",
  },
  {
    id: "bfc338aa-93c5-474d-a9dd-d45859a601f5",
    sellerKey: "jordan",
    media: [
      "house5.jpg",
      "houseinterior5.jpg",
      "ezgif-495da2625ad7c5dc.gif",
      "15641149_1920_1080_60fps.mp4",
    ],
    tags: ["heating system", "basement"],
    title: "Affordable City Apartment",
    price: 280000,
    beds: 1,
    baths: 1,
    sqft: 750,
    address: "45 River St, Chicago, IL",
    description:
      "Compact apartment with basement storage and heating system.",
    createdAt: "2026-07-24T20:18:49.529195+00:00",
    updatedAt: "2026-10-11T18:25:07.202118+00:00",
  },
  {
    id: "dd90c583-f2d0-4276-8e5d-fa424592cdf3",
    sellerKey: "priya",
    media: [
      "house6.jpg",
      "houseinterior6.jpg",
      "ezgif-48c46f6d315d6b04.gif",
      "6003895-uhd_2160_3840_30fps.mp4",
    ],
    tags: ["air conditioning", "balcony"],
    title: "Downtown Skyline Condo",
    price: 620000,
    beds: 2,
    baths: 2,
    sqft: 1350,
    address: "300 Market St, San Francisco, CA",
    description:
      "High-rise condo with skyline views, balcony, and modern amenities.",
    createdAt: "2026-07-24T20:18:49.529195+00:00",
    updatedAt: "2026-10-11T18:25:07.202118+00:00",
  },
  {
    id: "a0000000-0000-4000-8000-000000000001",
    sellerKey: "daniel",
    media: [
      "pexels-makayla-asuncion-2155237133-34625609.jpg",
      "pexels-furkanfdemir-5816563.jpg",
      "ezgif-4251dd0cd6760234.gif",
      "15887076-uhd_3840_2160_60fps (1).mp4",
    ],
    tags: ["garden", "hardwood floors", "garage"],
    title: "Craftsman Bungalow with Garden",
    price: 465000,
    beds: 3,
    baths: 2,
    sqft: 1950,
    address: "1428 Cedar St, Portland, OR",
    description:
      "A character-filled craftsman bungalow with a private garden, warm interior finishes, and a detached garage.",
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    sellerKey: "maya",
    media: [
      "pexels-nicole-king-206551188-36793072.jpg",
      "pexels-artbovich-6527069.jpg",
      "ezgif-43d896c1006bf7f2.gif",
      "14950807_2160_3840_60fps (1).mp4",
    ],
    tags: ["balcony", "patio", "garden"],
    title: "Lakeside Contemporary Retreat",
    price: 975000,
    beds: 4,
    baths: 3,
    sqft: 3200,
    address: "27 Lakeshore Dr, Lake Geneva, WI",
    description:
      "A contemporary lakeside home with a spacious deck, open living areas, and views toward the water.",
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    sellerKey: "jordan",
    media: [
      "pexels-masonamccall-12168579.jpg",
      "pexels-nadin-sh-78971847-16451357.jpg",
      "ezgif-4bb74493579852a2.gif",
      "3769951-hd_1920_1080_25fps.mp4",
    ],
    tags: ["hardwood floors", "carpeted floors"],
    title: "Urban Loft near Transit",
    price: 365000,
    beds: 1,
    baths: 1,
    sqft: 980,
    address: "615 Wazee St, Denver, CO",
    description:
      "An urban loft with an open layout, exposed brick details, and convenient access to public transit.",
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    sellerKey: "jordan",
    media: [
      "pexels-lucky-camera-1300296351-28468114.jpg",
      "pexels-maorattias-5192377.jpg",
      "ezgif-495d034a717c5e7b.gif",
      "6010497-uhd_3840_2160_25fps.mp4",
    ],
    tags: ["patio", "swimming pool", "garden"],
    title: "Mediterranean Courtyard Home",
    price: 745000,
    beds: 4,
    baths: 3,
    sqft: 2850,
    address: "8090 E Via Linda, Scottsdale, AZ",
    description:
      "A Mediterranean-inspired home centered around a private courtyard, with outdoor entertaining space and energy-conscious features.",
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    sellerKey: "priya",
    media: [
      "pexels-matreding-11299546.jpg",
      "pexels-artbovich-6077368.jpg",
      "ezgif-44bcbfdb5fd212d1.gif",
      "15386844_3840_2160_60fps.mp4",
    ],
    tags: ["balcony", "carpeted floors"],
    title: "Bright Corner Penthouse",
    price: 890000,
    beds: 2,
    baths: 2,
    sqft: 1600,
    address: "88 Seaport Blvd, Boston, MA",
    description:
      "A bright corner penthouse featuring a private balcony, open views, and contemporary finishes.",
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
  {
    id: "a0000000-0000-4000-8000-000000000006",
    sellerKey: "priya",
    media: [
      "pexels-kaue-barbier-710715348-33799052.jpg",
      "pexels-introspectivedsgn-9890644.jpg",
      "ezgif-4d5e0c65d62d9736.gif",
      "3785183-hd_1920_1080_25fps.mp4",
    ],
    tags: ["fireplace", "patio", "garden"],
    title: "Mountain View Cabin",
    price: 540000,
    beds: 3,
    baths: 2,
    sqft: 1750,
    address: "214 Ridgeview Trail, Asheville, NC",
    description:
      "A mountain-view cabin with a stone fireplace, timber details, and a covered deck for enjoying the surrounding landscape.",
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
] as const satisfies readonly SeedListing[];

export type SeedListingId = (typeof seedListings)[number]["id"];

export interface SeedReview {
  id: string;
  listingId: SeedListingId;
  reviewerKey: SeedReviewerKey;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Each listing receives exactly four seller-authored reviews:
 * one from each seller, including the listing owner.
 *
 * Ratings are derived from these individual reviews. No aggregate stars
 * are stored on the listings themselves.
 */
const sellerRatingsByListing: readonly (
  readonly [number, number, number, number]
)[] = [
  [4, 5, 5, 4],
  [5, 4, 5, 5],
  [4, 4, 5, 5],
  [5, 5, 4, 4],
  [4, 3, 5, 4],
  [4, 4, 4, 5],
  [5, 4, 5, 4],
  [4, 5, 4, 5],
  [5, 5, 4, 4],
  [4, 4, 5, 4],
  [5, 4, 4, 5],
  [4, 5, 5, 4],
];

const sellerReviewComments = [
  (title: string) =>
    `The listing for ${title} gives a clear picture of the property's layout and main features.`,
  (title: string) =>
    `${title} has a useful combination of space and amenities for someone comparing homes in this range.`,
  (title: string) =>
    `The description for ${title} covers several details I would compare first, including the rooms and features.`,
  (title: string) =>
    `${title} looks like a promising option, with a practical mix of property size and listed amenities.`,
] as const;

function stableSellerReviewId(sequence: number): string {
  return `90000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

/**
 * Generate deterministic review timestamps relative to the listing's
 * creation date. Each of the four reviewers receives a different day.
 */
function stableSellerReviewTimestamp(
  listingCreatedAt: string,
  sellerIndex: number,
): string {
  const listingCreatedAtMs = Date.parse(listingCreatedAt);

  if (!Number.isFinite(listingCreatedAtMs)) {
    throw new Error(
      `Invalid listing creation timestamp: ${listingCreatedAt}`,
    );
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  const reviewOffsetMs = (sellerIndex + 1) * oneDayMs;

  return new Date(
    listingCreatedAtMs + reviewOffsetMs,
  ).toISOString();
}

export const seedSellerReviews: SeedReview[] = seedListings.flatMap(
  (listing, listingIndex) =>
    seedSellers.map((seller, sellerIndex): SeedReview => {
      const sequence =
        listingIndex * seedSellers.length + sellerIndex;

      const createdAt = stableSellerReviewTimestamp(
        listing.createdAt,
        sellerIndex,
      );

      return {
        id: stableSellerReviewId(sequence + 1),
        listingId: listing.id,
        reviewerKey: seller.key,
        rating: sellerRatingsByListing[listingIndex][sellerIndex],
        comment: sellerReviewComments[sellerIndex](listing.title),
        createdAt,
        updatedAt: createdAt,
      };
    }),
);

/**
 * Exactly 48 intended reviews: four sellers reviewing twelve listings.
 *
 * Historical reviews from the archived database are preserved in
 * seed/snapshots/existing-mock-data.json, not duplicated here.
 */
export const seedReviews: SeedReview[] = seedSellerReviews;

/**
 * Pure fixture validation. This does not connect to or modify the database.
 */
export function validateSeedData(): void {
  if (seedSellers.length !== 4) {
    throw new Error("Expected exactly four sellers.");
  }

  if (seedListings.length !== 12) {
    throw new Error("Expected exactly twelve listings.");
  }

  if (seedReviews.length !== 48) {
    throw new Error(`Expected 48 reviews; found ${seedReviews.length}.`);
  }

  const sellerKeys = new Set(seedSellers.map((seller) => seller.key));

  if (sellerKeys.size !== seedSellers.length) {
    throw new Error("Seed seller keys must be unique.");
  }

  const sellerEmails = new Set(
    seedSellers.map((seller) => seller.email.toLowerCase()),
  );

  if (sellerEmails.size !== seedSellers.length) {
    throw new Error("Seed seller emails must be unique.");
  }

  const listingIds = new Set(seedListings.map((listing) => listing.id));

  if (listingIds.size !== seedListings.length) {
    throw new Error("Seed listing IDs must be unique.");
  }

  for (const seller of seedSellers) {
    const count = seedListings.filter(
      (listing) => listing.sellerKey === seller.key,
    ).length;

    if (count !== 3) {
      throw new Error(
        `Seller "${seller.key}" must own 3 listings; found ${count}.`,
      );
    }

    const { profile } = seller;

    if (
      profile.preferredContactMethod !== "email" &&
      profile.preferredContactMethod !== "phone"
    ) {
      throw new Error(
        `Seller "${seller.key}" has an invalid preferred contact method.`,
      );
    }

    if (
      profile.preferredContactMethod === "email" &&
      !profile.contactEmail?.trim()
    ) {
      throw new Error(
        `Seller "${seller.key}" prefers email but has no contact email.`,
      );
    }

    if (
      profile.preferredContactMethod === "phone" &&
      !profile.contactPhone?.trim()
    ) {
      throw new Error(
        `Seller "${seller.key}" prefers phone but has no contact phone.`,
      );
    }
  }

  const reviewIds = new Set(seedReviews.map((review) => review.id));

  if (reviewIds.size !== seedReviews.length) {
    throw new Error("Seed review IDs must be unique.");
  }

  const reviewerKeys = new Set<string>(
    seedSellers.map((seller) => seller.key),
  );

  const listingReviewerPairs = new Set<string>();

  for (const review of seedReviews) {
    if (!listingIds.has(review.listingId)) {
      throw new Error(
        `Review "${review.id}" references a missing listing.`,
      );
    }

    if (!reviewerKeys.has(review.reviewerKey)) {
      throw new Error(
        `Review "${review.id}" references an unknown reviewer.`,
      );
    }

    if (
      !Number.isInteger(review.rating) ||
      review.rating < 1 ||
      review.rating > 5
    ) {
      throw new Error(
        `Review "${review.id}" must have an integer rating from 1 to 5.`,
      );
    }

    const pairKey = `${review.listingId}:${review.reviewerKey}`;

    if (listingReviewerPairs.has(pairKey)) {
      throw new Error(
        `Duplicate review for listing "${review.listingId}" from "${review.reviewerKey}".`,
      );
    }

    listingReviewerPairs.add(pairKey);

    const listing = seedListings.find(
      (candidate) => candidate.id === review.listingId,
    );

    if (!listing) {
      throw new Error(
        `Review "${review.id}" references a missing listing.`,
      );
    }

    const listingCreatedAtMs = Date.parse(listing.createdAt);
    const reviewCreatedAtMs = Date.parse(review.createdAt);

    if (
      !Number.isFinite(listingCreatedAtMs) ||
      !Number.isFinite(reviewCreatedAtMs)
    ) {
      throw new Error(
        `Listing or review "${review.id}" has an invalid timestamp.`,
      );
    }

    if (reviewCreatedAtMs <= listingCreatedAtMs) {
      throw new Error(
        `Review "${review.id}" must be created after its listing.`,
      );
    }
  }

  for (const listing of seedListings) {
    const listingReviews = seedReviews.filter(
      (review) => review.listingId === listing.id,
    );

    if (listingReviews.length !== seedSellers.length) {
      throw new Error(
        `Listing "${listing.id}" must have exactly four reviews; found ${listingReviews.length}.`,
      );
    }

    for (const seller of seedSellers) {
      if (
        !listingReviews.some((review) => review.reviewerKey === seller.key)
      ) {
        throw new Error(
          `Listing "${listing.id}" is missing a review from "${seller.key}".`,
        );
      }
    }
  }
}
