-- Protect the four canonical synthetic fixture identities from demo retention cleanup.
-- Apply this forward-only migration before enabling the demo signup bypass.
CREATE OR REPLACE FUNCTION private.list_expired_demo_accounts(p_limit integer)
RETURNS TABLE (id text, image text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT u.id::text, u.image::text
    FROM public.users AS u
   WHERE u.demo_expires_at IS NOT NULL
     AND u.demo_expires_at <= pg_catalog.now()
     AND pg_catalog.lower(u.email) NOT IN (
       'daniel.carter@example.com',
       'maya.thompson@example.com',
       'jordan.lee@example.com',
       'priya.patel@example.com'
     )
   ORDER BY u.demo_expires_at
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 1), 1), 50);
$function$;
--> statement-breakpoint

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
    FROM public.users AS u
   WHERE u.id = p_user_id
     AND u.demo_expires_at IS NOT NULL
     AND u.demo_expires_at <= pg_catalog.now()
     AND pg_catalog.lower(u.email) NOT IN (
       'daniel.carter@example.com',
       'maya.thompson@example.com',
       'jordan.lee@example.com',
       'priya.patel@example.com'
     )
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.listings
   WHERE seller_user_id = p_user_id;

  DELETE FROM public.seller_profiles
   WHERE user_id = p_user_id;

  DELETE FROM public.users AS u
   WHERE u.id = p_user_id
     AND u.demo_expires_at IS NOT NULL
     AND u.demo_expires_at <= pg_catalog.now()
     AND pg_catalog.lower(u.email) NOT IN (
       'daniel.carter@example.com',
       'maya.thompson@example.com',
       'jordan.lee@example.com',
       'priya.patel@example.com'
     );

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows = 1;
END;
$function$;
--> statement-breakpoint

-- Preserve the restricted execution boundary when replacing the routines.
REVOKE ALL ON FUNCTION private.list_expired_demo_accounts(integer)
  FROM PUBLIC, anon, authenticated, service_role, evergreen_read, evergreen_runtime, evergreen_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.list_expired_demo_accounts(integer)
  TO evergreen_auth;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.delete_expired_demo_account(uuid)
  FROM PUBLIC, anon, authenticated, service_role, evergreen_read, evergreen_runtime, evergreen_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.delete_expired_demo_account(uuid)
  TO evergreen_auth;
