-- Opt-in demo accounts carry an expiry timestamp; NULL means not managed by demo cleanup.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz;
--> statement-breakpoint

-- Keep maintenance functions outside Supabase's exposed public schema.
CREATE SCHEMA IF NOT EXISTS private;
--> statement-breakpoint
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
GRANT USAGE ON SCHEMA private TO evergreen_auth;
--> statement-breakpoint

-- The auth runtime can invoke only a routine that rechecks the expiry before deleting.
-- Listings are removed before their seller profile because the listing FK restricts profile deletion.
CREATE OR REPLACE FUNCTION private.delete_expired_demo_account(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  deleted_rows bigint;
BEGIN
  PERFORM 1
    FROM public.users
   WHERE id = p_user_id
     AND demo_expires_at IS NOT NULL
     AND demo_expires_at <= pg_catalog.now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.listings
   WHERE seller_user_id = p_user_id;

  DELETE FROM public.seller_profiles
   WHERE user_id = p_user_id;

  DELETE FROM public.users
   WHERE id = p_user_id
     AND demo_expires_at IS NOT NULL
     AND demo_expires_at <= pg_catalog.now();

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows = 1;
END;
$function$;
--> statement-breakpoint

-- Do not permit direct execution by browser-facing roles or the app-write role.
REVOKE ALL ON FUNCTION private.delete_expired_demo_account(uuid)
  FROM PUBLIC, anon, authenticated, service_role, evergreen_read, evergreen_runtime, evergreen_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.delete_expired_demo_account(uuid)
  TO evergreen_auth;
