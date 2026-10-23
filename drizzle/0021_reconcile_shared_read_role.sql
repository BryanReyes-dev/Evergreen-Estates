-- Forward-only reconciliation of the shared-read contract originally introduced
-- by 0011_shared_read_role.sql.
--
-- The original SQL body represented by the existing Drizzle 0011 checksum could
-- not be recovered from Git history or Supabase's migration history. Do not edit
-- drizzle/0011_shared_read_role.sql or rewrite its existing ledger row. This
-- migration deliberately reasserts the intended live role/grant/policy contract
-- without changing application data or the historical migration record.

-- Role attributes are checked by the population preflight and are already correct.
-- Supabase's managed postgres connection cannot alter role security attributes,
-- so this reconciliation leaves the role definition unchanged.

GRANT USAGE ON SCHEMA public TO evergreen_read;
--> statement-breakpoint

-- The shared role has table-level read access to these public listing surfaces.
REVOKE ALL PRIVILEGES
ON TABLE public.listings, public.reviews, public.seller_profiles
FROM evergreen_read;
--> statement-breakpoint

GRANT SELECT
ON TABLE public.listings, public.reviews, public.seller_profiles
TO evergreen_read;
--> statement-breakpoint

-- Public user identity is limited to id, name, and avatar. It must not expose
-- login email, auth verification state, timestamps, saved homes, or preferences.
REVOKE ALL PRIVILEGES ON TABLE public.users FROM evergreen_read;
--> statement-breakpoint
REVOKE SELECT (
  id, name, email, email_verified, image, created_at, updated_at,
  saved_listings, preferences
)
ON TABLE public.users FROM evergreen_read;
--> statement-breakpoint

GRANT SELECT (id, name, image)
ON TABLE public.users TO evergreen_read;
--> statement-breakpoint

-- Runtime receives shared reads only by inherited membership, never direct
-- table-level or user-column grants. Column-level privileges are independent
-- of table-level grants, so revoke them explicitly as well.
REVOKE ALL PRIVILEGES
ON TABLE public.listings, public.reviews, public.seller_profiles, public.users
FROM evergreen_runtime;
--> statement-breakpoint
REVOKE SELECT (
  id, name, email, email_verified, image, created_at, updated_at,
  saved_listings, preferences
)
ON TABLE public.users FROM evergreen_runtime;
--> statement-breakpoint
REVOKE INSERT (
  id, name, email, email_verified, image, created_at, updated_at,
  saved_listings, preferences
)
ON TABLE public.users FROM evergreen_runtime;
--> statement-breakpoint
REVOKE UPDATE (
  id, name, email, email_verified, image, created_at, updated_at,
  saved_listings, preferences
)
ON TABLE public.users FROM evergreen_runtime;
--> statement-breakpoint

-- Preserve the exact membership boundary: inherit reads but never SET ROLE.
GRANT evergreen_read TO evergreen_runtime WITH INHERIT TRUE, SET FALSE;
--> statement-breakpoint
GRANT evergreen_read TO evergreen_app WITH INHERIT TRUE, SET FALSE;
--> statement-breakpoint

-- Recreate only the known shared-read policies. Owner policies and saved-home
-- restrictive policies are left untouched.
DROP POLICY IF EXISTS "Runtime can read listings" ON public.listings;
--> statement-breakpoint
DROP POLICY IF EXISTS "Shared read role can read listings" ON public.listings;
--> statement-breakpoint
CREATE POLICY "Shared read role can read listings"
ON public.listings AS PERMISSIVE FOR SELECT TO evergreen_read USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "Runtime can read reviews" ON public.reviews;
--> statement-breakpoint
DROP POLICY IF EXISTS "Shared read role can read reviews" ON public.reviews;
--> statement-breakpoint
CREATE POLICY "Shared read role can read reviews"
ON public.reviews AS PERMISSIVE FOR SELECT TO evergreen_read USING (true);
--> statement-breakpoint

DROP POLICY IF EXISTS "Runtime can read published seller storefronts" ON public.seller_profiles;
--> statement-breakpoint
DROP POLICY IF EXISTS "Shared read role can read published seller storefronts" ON public.seller_profiles;
--> statement-breakpoint
CREATE POLICY "Shared read role can read published seller storefronts"
ON public.seller_profiles AS PERMISSIVE FOR SELECT TO evergreen_read
USING (is_published = true);
--> statement-breakpoint

DROP POLICY IF EXISTS "Runtime can read application user identity" ON public.users;
--> statement-breakpoint
DROP POLICY IF EXISTS "Shared read role can read application user identity" ON public.users;
--> statement-breakpoint
CREATE POLICY "Shared read role can read application user identity"
ON public.users AS PERMISSIVE FOR SELECT TO evergreen_read USING (true);
