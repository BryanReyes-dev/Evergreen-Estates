import {
  and,
  arrayContains,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import type { Houselisting, filters as Filters } from "@/app/types";
import { getDrizzleDb } from "@/db/drizzle/client";
import { listings, reviews, users } from "@/db/schema";
import getMediaUrls from "@/db/supabase/util/GetMediaUrls";

const UUID_PATTERN =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


export async function getListingById(
  id: string,
): Promise<Houselisting | null> {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const db = getDrizzleDb();

  try {
    // Fetch only the required listing columns.
    const [listing] = await db
      .select({
        id: listings.id,
        media: listings.media,
        tags: listings.tags,
        title: listings.title,
        price: listings.price,
        beds: listings.beds,
        baths: listings.baths,
        sqft: listings.sqft,
        address: listings.address,
        description: listings.description,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);

    if (!listing) {
      return null;
    }

    // Explicitly select only the permitted public user fields.
    // This avoids Drizzle's relational query generating SELECT *
    // against the restricted users table.
    const reviewRows = await db
      .select({
        id: reviews.id,
        listingId: reviews.listingId,
        userId: reviews.userId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        authorId: users.id,
        authorName: users.name,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.listingId, listing.id));

    const media = await getMediaUrls(
      listing.id,
      listing.media,
    );

    return {
      id: listing.id,
      media,
      tags: listing.tags,
      title: listing.title,
      price: Number(listing.price),
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      address: listing.address,
      description: listing.description,
      created_at: listing.createdAt,
      reviews: reviewRows.map((review) => ({
        id: review.id,
        listing_id: review.listingId,
        user_id: review.userId,
        rating: review.rating,
        comment: review.comment,
        created_at: review.createdAt,
        user: {
          id: review.authorId ?? review.userId,
          name: review.authorName ?? "Unknown user",
        },
      })),
    };
  } catch (error) {
    console.error("Error fetching listing with Drizzle:", error);
    throw error;
  }
}


export async function getFilteredListings(
  filters: Filters,
): Promise<Houselisting[]> {
  const db = getDrizzleDb();
  const conditions: SQL[] = [];

  if (filters.price !== null) {
    const [minPrice, maxPrice] = filters.price;

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      throw new Error("Invalid price filter values");
    }

    conditions.push(gte(listings.price, String(minPrice)));
    conditions.push(lte(listings.price, String(maxPrice)));
  }

  const search = filters.search?.trim();
  if (search) {
    const searchCondition = or(
      ilike(listings.title, `%${search}%`),
      ilike(listings.description, `%${search}%`),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(arrayContains(listings.tags, filters.tags));
  }

  try {
    const rows = await db
      .select({
        id: listings.id,
        media: listings.media,
        tags: listings.tags,
        title: listings.title,
        price: listings.price,
        beds: listings.beds,
        baths: listings.baths,
        sqft: listings.sqft,
        address: listings.address,
        description: listings.description,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return await Promise.all(
      rows.map(async (row): Promise<Houselisting> => ({
        id: row.id,
        media: await getMediaUrls(row.id, row.media),
        tags: row.tags,
        title: row.title,
        price: Number(row.price),
        beds: row.beds,
        baths: row.baths,
        sqft: row.sqft,
        address: row.address,
        description: row.description,
        created_at: row.createdAt,
        reviews: [],
      })),
    );
  } catch (error) {
    console.error("Error fetching filtered listings with Drizzle:", error);
    throw error;
  }
}
