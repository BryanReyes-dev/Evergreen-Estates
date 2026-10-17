
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";


export const users = pgTable(
  "users",
  {
    // Definition for users table
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),


    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("users_email_key").on(table.email),


    // Server-side read visibility. SQL column grants restrict the runtime
    // connection to id and name; public clients use the Route Handlers.
    pgPolicy("Runtime can read application user identity", {
      as: "permissive",
      for: "select",
      to: ["evergreen_runtime"],
      using: sql`true`,
    }),

    pgPolicy("Evergreen auth can manage users", {
      as: "permissive",
      for: "all",
      to: ["evergreen_auth"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export const sellerProfiles = pgTable(
  "seller_profiles",
  {
    userId: uuid("user_id").primaryKey().notNull(),


    displayName: text("display_name").notNull(),
    bio: text(),
    avatarUrl: text("avatar_url"),

    // These contact details are intended to be public when published.
    // contactEmail is separate from the private login email.
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    preferredContactMethod: text("preferred_contact_method")
      .notNull(),


    isPublished: boolean("is_published").notNull().default(false),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "seller_profiles_user_id_fkey",
    }).onDelete("cascade"),


    check(
      "seller_profiles_contact_method_check",
      sql`(\n\t\t\t${table.preferredContactMethod} = 'email'\n\t\t\tAND ${table.contactEmail} IS NOT NULL\n\t\t) OR (\n\t\t\t${table.preferredContactMethod} = 'phone'\n\t\t\tAND ${table.contactPhone} IS NOT NULL\n\t\t)`,
    ),

    // The public API may expose published storefronts only.
    pgPolicy("Runtime can read published seller storefronts", {
      as: "permissive",
      for: "select",
      to: ["evergreen_runtime"],
      using: sql`${table.isPublished} = true`,
    }),
  ],
).enableRLS();

export const listings = pgTable(
  "listings",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    media: text().array().notNull(),
    tags: text().array().notNull(),
    title: text().notNull(),
    price: numeric().notNull(),
    beds: integer().notNull(),
    baths: integer().notNull(),
    sqft: integer().notNull(),
    address: text().notNull(),
    description: text().notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),


    // Nullable during migration because existing listings don't yet map
    // to a seller profile. New listing creation must require an owner.
    sellerUserId: uuid("seller_user_id"),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.sellerUserId],
      foreignColumns: [sellerProfiles.userId],
      name: "listings_seller_user_id_fkey",
    }).onDelete("restrict"),

    index("listings_seller_user_id_idx").on(table.sellerUserId),

    pgPolicy("Runtime can read listings", {
      as: "permissive",
      for: "select",
      to: ["evergreen_runtime"],
      using: sql`true`,
    }),
  ],
).enableRLS();

export const reviews = pgTable(
  "reviews",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    listingId: uuid("listing_id").notNull(),
    userId: uuid("user_id").notNull(),
    rating: integer().notNull(),
    comment: text().notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.listingId],
      foreignColumns: [listings.id],
      name: "reviews_listing_id_fkey",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "reviews_user_id_fkey",
    }).onDelete("cascade"),

    unique("reviews_listing_user_unique").on(
      table.listingId,
      table.userId,
    ),

    index("reviews_user_id_idx").on(table.userId),

    pgPolicy("Runtime can read reviews", {
      as: "permissive",
      for: "select",
      to: ["evergreen_runtime"],
      using: sql`true`,
    }),

    check(
      "reviews_rating_check",
      sql`(${table.rating} >= 1) AND (${table.rating} <= 5)`,
    ),
  ],
).enableRLS();
