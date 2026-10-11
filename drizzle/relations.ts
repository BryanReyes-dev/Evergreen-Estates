import { relations } from "drizzle-orm/relations";
import { listings, reviews, users } from "./schema";

export const reviewsRelations = relations(reviews, ({one}) => ({
	listing: one(listings, {
		fields: [reviews.listingId],
		references: [listings.id]
	}),
	user: one(users, {
		fields: [reviews.userId],
		references: [users.id]
	}),
}));

export const listingsRelations = relations(listings, ({many}) => ({
	reviews: many(reviews),
}));

export const usersRelations = relations(users, ({many}) => ({
	reviews: many(reviews),
}));