-- Allow the demo cleanup runtime to enumerate only expired demo accounts.
-- The runtime role cannot read public.users directly; this narrowly scoped function
-- exposes only account IDs and avatar paths for accounts already past their expiry.
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
   ORDER BY u.demo_expires_at
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 1), 1), 50);
$function$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION private.list_expired_demo_accounts(integer)
  FROM PUBLIC, anon, authenticated, service_role, evergreen_read, evergreen_runtime, evergreen_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.list_expired_demo_accounts(integer)
  TO evergreen_auth;
