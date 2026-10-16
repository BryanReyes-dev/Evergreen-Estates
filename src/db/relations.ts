
import { relations } from "drizzle-orm/relations";
import {
  listings,
  reviews,
  sellerProfiles,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  reviews: many(reviews),
  sellerProfile: one(sellerProfiles),
}));

export const sellerProfilesRelations = relations(
  sellerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [sellerProfiles.userId],
      references: [users.id],
    }),
    listings: many(listings),
  }),
);

export const listingsRelations = relations(
  listings,
  ({ many, one }) => ({
    reviews: many(reviews),
    sellerProfile: one(sellerProfiles, {
      fields: [listings.sellerUserId],
      references: [sellerProfiles.userId],
    }),
  }),
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  listing: one(listings, {
    fields: [reviews.listingId],
    references: [listings.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));
