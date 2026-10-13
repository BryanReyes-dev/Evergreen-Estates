
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

// Application profile data.
// The legacy email column is retained to preserve existing records.
// Database grants restrict anon/authenticated reads to id and name.
// Consider removing email after the authentication migration and data review.
export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),

    // Links this profile to Better Auth once authentication is integrated.
    // Nullable so existing profiles can be preserved during migration.
    authUserId: uuid("auth_user_id"),

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
    unique("users_auth_user_id_key").on(table.authUserId),

    // Public row visibility. Column-level SQL grants will separately
    // restrict public reads to id and name.
    pgPolicy("Enable read access for all users", {
      as: "permissive",
      for: "select",
      to: ["anon", "authenticated", "evergreen_readonly"],
      using: sql`true`,
    }),
  ],
);

// One storefront per application user.
// There is intentionally no separate seller-profile ID.
export const sellerProfiles = pgTable(
  "seller_profiles",
  {
    userId: uuid("user_id").primaryKey().notNull(),

    slug: text().notNull(),
    displayName: text("display_name").notNull(),
    bio: text(),
    avatarUrl: text("avatar_url"),

    // These contact details are intended to be public when published.
    // contactEmail is separate from the private login email.
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    preferredContactMethod: text("preferred_contact_method")
      .notNull()
      .default("email"),

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

    unique("seller_profiles_slug_key").on(table.slug),
    check(
      "seller_profiles_contact_method_check",
      sql`(
        ${table.preferredContactMethod} = 'email'
        AND ${table.contactEmail} IS NOT NULL
      ) OR (
        ${table.preferredContactMethod} = 'phone'
        AND ${table.contactPhone} IS NOT NULL
      )`,
    ),

    // Guests and buyers can discover published storefronts only.
    pgPolicy("Published seller storefronts are publicly readable", {
      as: "permissive",
      for: "select",
      to: ["anon", "authenticated", "evergreen_readonly"],
      using: sql`${table.isPublished} = true`,
    }),
  ],
);

export const listings = pgTable(
  "listings",
  {
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

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),

    // Legacy display label retained until the existing Admin listings
    // have an explicit ownership/backfill decision.
    seller: text().notNull(),

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

    pgPolicy("Enable read access for all users", {
      as: "permissive",
      for: "select",
      to: ["anon", "authenticated", "evergreen_readonly"],
      using: sql`true`,
    }),
  ],
);

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

    pgPolicy("Enable read access for all users", {
      as: "permissive",
      for: "select",
      to: ["anon", "authenticated", "evergreen_readonly"],
      using: sql`true`,
    }),

    check(
      "reviews_rating_check",
      sql`(${table.rating} >= 1) AND (${table.rating} <= 5)`,
    ),
  ],
);
