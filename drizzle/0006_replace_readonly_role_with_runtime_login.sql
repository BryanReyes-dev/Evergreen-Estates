-- Replace the temporary non-login read group with the application's
-- dedicated, restricted Drizzle runtime principal. Set the password out-of-band.
CREATE ROLE evergreen_runtime
  WITH LOGIN INHERIT
       NOSUPERUSER NOCREATEDB NOCREATEROLE
       NOREPLICATION NOBYPASSRLS;
--> statement-breakpoint

GRANT CONNECT ON DATABASE postgres TO evergreen_runtime;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO evergreen_runtime;
--> statement-breakpoint

-- Start from no direct table privileges, then grant only the public read surface.
REVOKE ALL PRIVILEGES
ON TABLE public.users, public.seller_profiles, public.listings, public.reviews
FROM evergreen_runtime;
--> statement-breakpoint

GRANT SELECT ON TABLE public.seller_profiles, public.listings, public.reviews
TO evergreen_runtime;
--> statement-breakpoint

-- Public review-author identity only; never expose login email/auth linkage.
GRANT SELECT (id, name)
ON TABLE public.users
TO evergreen_runtime;
--> statement-breakpoint

-- A direct Drizzle connection runs as evergreen_runtime, so explicitly
-- include that role in the matching read policies. Public API roles remain.
ALTER POLICY "Enable read access for all users"
ON public.listings
TO anon, authenticated, evergreen_runtime;
--> statement-breakpoint

ALTER POLICY "Enable read access for all users"
ON public.reviews
TO anon, authenticated, evergreen_runtime;
--> statement-breakpoint

ALTER POLICY "Enable read access for all users"
ON public.users
TO anon, authenticated, evergreen_runtime;
--> statement-breakpoint

ALTER POLICY "Published seller storefronts are publicly readable"
ON public.seller_profiles
TO anon, authenticated, evergreen_runtime;
--> statement-breakpoint

-- Remove the migration-0005 temporary role after all references/grants move.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM evergreen_readonly;
--> statement-breakpoint
-- Column-level privileges are separate from table-level grants.
REVOKE SELECT (id, name) ON TABLE public.users FROM evergreen_readonly;
--> statement-breakpoint
REVOKE USAGE ON SCHEMA public FROM evergreen_readonly;
--> statement-breakpoint
REVOKE CONNECT ON DATABASE postgres FROM evergreen_readonly;
--> statement-breakpoint
REVOKE evergreen_readonly FROM postgres;
--> statement-breakpoint
DROP ROLE evergreen_readonly;
