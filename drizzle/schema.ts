import { pgTable, pgPolicy, uuid, text, numeric, integer, timestamp, foreignKey, unique, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const listings = pgTable("listings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	media: text().array().notNull(),
	tags: text().array().notNull(),
	title: text().notNull(),
	price: numeric().notNull(),
	stars: numeric().notNull(),
	beds: integer().notNull(),
	baths: integer().notNull(),
	sqft: integer().notNull(),
	address: text().notNull(),
	description: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	seller: text().notNull(),
}, (table) => [
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`true` }),
]);

export const reviews = pgTable("reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	listingId: uuid("listing_id").notNull(),
	userId: uuid("user_id").notNull(),
	rating: integer().notNull(),
	comment: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [listings.id],
			name: "reviews_listing_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "reviews_user_id_fkey"
		}).onDelete("cascade"),
	unique("reviews_listing_user_unique").on(table.listingId, table.userId),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`true` }),
	check("reviews_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),
	pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`true` }),
]);
