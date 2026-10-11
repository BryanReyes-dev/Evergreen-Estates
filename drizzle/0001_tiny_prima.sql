CREATE TABLE "seller_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"preferred_contact_method" text DEFAULT 'email' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_profiles_slug_key" UNIQUE("slug"),
	CONSTRAINT "seller_profiles_contact_method_check" CHECK ("seller_profiles"."preferred_contact_method" IN ('email', 'phone')
        AND (
          "seller_profiles"."preferred_contact_method" <> 'phone'
          OR "seller_profiles"."contact_phone" IS NOT NULL
        ))
);
--> statement-breakpoint
ALTER TABLE "seller_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "seller_user_id" uuid;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_seller_user_id_idx" ON "listings" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_key" UNIQUE("auth_user_id");--> statement-breakpoint
CREATE POLICY "Published seller storefronts are publicly readable" ON "seller_profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("seller_profiles"."is_published" = true);

-- Public profile fields only.
-- Remove table-wide and column-level access first.
REVOKE ALL PRIVILEGES
ON TABLE public.users
FROM PUBLIC, anon, authenticated;

REVOKE SELECT (
  id,
  name,
  email,
  auth_user_id,
  created_at,
  updated_at
)
ON TABLE public.users
FROM PUBLIC, anon, authenticated;

-- Guests and buyers can read profile identity, not private account email.
GRANT SELECT (id, name)
ON TABLE public.users
TO anon, authenticated;

-- Published storefronts are public; storefront writes stay server-side.
REVOKE ALL PRIVILEGES
ON TABLE public.seller_profiles
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.seller_profiles
TO anon, authenticated;

-- Automatically maintain updated_at for direct SQL and ORM updates.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER seller_profiles_updated_at_trigger
BEFORE UPDATE ON public.seller_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER listings_updated_at_trigger
BEFORE UPDATE ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reviews_updated_at_trigger
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
