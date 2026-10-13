-- Create a group role for server-side Drizzle reads. The role has no login
-- and receives SELECT permissions only; credentials are provisioned separately.
CREATE ROLE evergreen_readonly NOLOGIN;
--> statement-breakpoint

GRANT CONNECT ON DATABASE postgres TO evergreen_readonly;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO evergreen_readonly;
--> statement-breakpoint

REVOKE ALL PRIVILEGES
ON TABLE public.users, public.seller_profiles, public.listings, public.reviews
FROM evergreen_readonly;
--> statement-breakpoint

GRANT SELECT ON TABLE public.seller_profiles, public.listings, public.reviews
TO evergreen_readonly;
--> statement-breakpoint

-- Public display identity only; no login email or auth linkage.
GRANT SELECT (id, name)
ON TABLE public.users
TO evergreen_readonly;
--> statement-breakpoint

ALTER POLICY "Enable read access for all users"
ON public.listings
TO anon, authenticated, evergreen_readonly;
--> statement-breakpoint

ALTER POLICY "Enable read access for all users"
ON public.reviews
TO anon, authenticated, evergreen_readonly;
--> statement-breakpoint

ALTER POLICY "Enable read access for all users"
ON public.users
TO anon, authenticated, evergreen_readonly;
--> statement-breakpoint

ALTER POLICY "Published seller storefronts are publicly readable"
ON public.seller_profiles
TO anon, authenticated, evergreen_readonly;
