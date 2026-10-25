-- Persist the per-user saved-list array without exposing it to the runtime or auth roles.
ALTER TABLE public.users ADD COLUMN saved_listings uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
--> statement-breakpoint
ALTER TABLE public.users ADD CONSTRAINT users_saved_listings_max_100 CHECK (cardinality(saved_listings) <= 100);
--> statement-breakpoint
-- Better Auth only needs its mapped user columns; remove broad table privileges.
REVOKE SELECT, INSERT, UPDATE ON TABLE public.users FROM evergreen_auth;
--> statement-breakpoint
GRANT SELECT (id, name, email, email_verified, image, created_at, updated_at) ON TABLE public.users TO evergreen_auth;
--> statement-breakpoint
GRANT INSERT (id, name, email, email_verified, image, created_at, updated_at) ON TABLE public.users TO evergreen_auth;
--> statement-breakpoint
GRANT UPDATE (name, email, email_verified, image, updated_at) ON TABLE public.users TO evergreen_auth;
--> statement-breakpoint
GRANT SELECT (id, saved_listings) ON TABLE public.users TO evergreen_app;
--> statement-breakpoint
GRANT UPDATE (saved_listings) ON TABLE public.users TO evergreen_app;
--> statement-breakpoint
CREATE POLICY "App can read own saved listings" ON public.users AS PERMISSIVE FOR SELECT TO evergreen_app USING (id = nullif(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
-- evergreen_app inherits evergreen_read. This restrictive policy clamps SELECT visibility to the verified owner.
CREATE POLICY "App can only read own users row" ON public.users AS RESTRICTIVE FOR SELECT TO evergreen_app USING (id = nullif(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "App can update own saved listings" ON public.users AS PERMISSIVE FOR UPDATE TO evergreen_app USING (id = nullif(current_setting('app.current_user_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.remove_deleted_listing_from_saved_listings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $function$ BEGIN UPDATE public.users SET saved_listings = pg_catalog.array_remove(saved_listings, OLD.id) WHERE saved_listings @> ARRAY[OLD.id]::uuid[]; RETURN OLD; END; $function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.remove_deleted_listing_from_saved_listings() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER listings_remove_deleted_ids_from_saved_listings AFTER DELETE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.remove_deleted_listing_from_saved_listings();
