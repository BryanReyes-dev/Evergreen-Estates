ALTER TABLE "seller_profiles" DROP CONSTRAINT "seller_profiles_slug_key";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_auth_user_id_key";--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_profiles" ALTER COLUMN "preferred_contact_method" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "stars";--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "seller";--> statement-breakpoint
ALTER TABLE "seller_profiles" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "auth_user_id";