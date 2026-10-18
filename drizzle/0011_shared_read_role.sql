CREATE ROLE "evergreen_read";
--> statement-breakpoint
-- Allow the shared role to access objects in the public schema.
GRANT USAGE ON SCHEMA public TO evergreen_read;
--> statement-breakpoint

-- Shared read access to listings, reviews, and seller profiles.
GRANT SELECT ON TABLE
  public.listings,
  public.reviews,
  public.seller_profiles
  TO evergreen_read;
--> statement-breakpoint

-- Public identity access must not expose email addresses.
GRANT SELECT (id, name)
  ON TABLE public.users
  TO evergreen_read;
--> statement-breakpoint

-- Both login roles inherit shared reads without being able
-- to switch into evergreen_read using SET ROLE.
GRANT evergreen_read TO evergreen_runtime
  WITH INHERIT TRUE, SET FALSE;
--> statement-breakpoint

GRANT evergreen_read TO evergreen_app
  WITH INHERIT TRUE, SET FALSE;
--> statement-breakpoint

-- Remove runtime's duplicate direct table permissions.
-- Its read access will now come through evergreen_read.
REVOKE SELECT ON TABLE
  public.listings,
  public.reviews,
  public.seller_profiles
  FROM evergreen_runtime;
--> statement-breakpoint

REVOKE SELECT ON TABLE public.users
  FROM evergreen_runtime;
--> statement-breakpoint

REVOKE SELECT (id, name)
  ON TABLE public.users
  FROM evergreen_runtime;
--> statement-breakpoint
DROP POLICY "Runtime can read listings" ON "listings" CASCADE;--> statement-breakpoint
DROP POLICY "Runtime can read reviews" ON "reviews" CASCADE;--> statement-breakpoint
DROP POLICY "Runtime can read published seller storefronts" ON "seller_profiles" CASCADE;--> statement-breakpoint
DROP POLICY "Runtime can read application user identity" ON "users" CASCADE;--> statement-breakpoint
CREATE POLICY "Shared read role can read listings" ON "listings" AS PERMISSIVE FOR SELECT TO "evergreen_read" USING (true);--> statement-breakpoint
CREATE POLICY "Shared read role can read reviews" ON "reviews" AS PERMISSIVE FOR SELECT TO "evergreen_read" USING (true);--> statement-breakpoint
CREATE POLICY "Shared read role can read published seller storefronts" ON "seller_profiles" AS PERMISSIVE FOR SELECT TO "evergreen_read" USING ("seller_profiles"."is_published" = true);--> statement-breakpoint
CREATE POLICY "Shared read role can read application user identity" ON "users" AS PERMISSIVE FOR SELECT TO "evergreen_read" USING (true);