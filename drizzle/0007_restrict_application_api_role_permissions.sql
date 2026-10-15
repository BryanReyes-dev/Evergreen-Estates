-- Restrict Evergreen Estates application data to server-side runtime roles.
-- Supabase's built-in roles remain platform-managed, but have no grants on
-- these application tables. The Data API is disabled at the project level.

REVOKE ALL PRIVILEGES
ON TABLE public.users, public.seller_profiles, public.listings, public.reviews
FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint

-- Keep RLS aligned with the direct Drizzle read connection.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
--> statement-breakpoint
DROP POLICY IF EXISTS "Runtime can read application user identity" ON public.users;
--> statement-breakpoint
CREATE POLICY "Runtime can read application user identity"
ON public.users AS PERMISSIVE FOR SELECT TO evergreen_runtime USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "Published seller storefronts are publicly readable" ON public.seller_profiles;
--> statement-breakpoint
DROP POLICY IF EXISTS "Runtime can read published seller storefronts" ON public.seller_profiles;
--> statement-breakpoint
CREATE POLICY "Runtime can read published seller storefronts"
ON public.seller_profiles AS PERMISSIVE FOR SELECT TO evergreen_runtime
USING (is_published = true);
--> statement-breakpoint

DROP POLICY IF EXISTS "Enable read access for all users" ON public.listings;
--> statement-breakpoint
DROP POLICY IF EXISTS "Runtime can read listings" ON public.listings;
--> statement-breakpoint
CREATE POLICY "Runtime can read listings"
ON public.listings AS PERMISSIVE FOR SELECT TO evergreen_runtime USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "Enable read access for all users" ON public.reviews;
--> statement-breakpoint
DROP POLICY IF EXISTS "Runtime can read reviews" ON public.reviews;
--> statement-breakpoint
CREATE POLICY "Runtime can read reviews"
ON public.reviews AS PERMISSIVE FOR SELECT TO evergreen_runtime USING (true);
--> statement-breakpoint

-- Remove inherited/default API-role grants for application tables created by
-- the postgres role used by versioned Drizzle migrations.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;
