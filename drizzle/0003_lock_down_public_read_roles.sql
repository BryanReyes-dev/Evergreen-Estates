
-- Public listing and review access is read-only.
REVOKE ALL PRIVILEGES
ON TABLE public.listings, public.reviews
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.listings, public.reviews
TO anon, authenticated;

-- Do not expose the RLS automation function through public RPC.
REVOKE EXECUTE
ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;
