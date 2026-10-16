-- Defense in depth: protect internal migration history.
-- Ordinary API roles already lack access to this private schema.
ALTER TABLE drizzle.__drizzle_migrations
ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- This function is for timestamp triggers, not direct API calls.
REVOKE EXECUTE
ON FUNCTION public.set_updated_at()
FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint

-- service_role bypasses RLS; remove unnecessary table truncation.
REVOKE TRUNCATE
ON TABLE
  public.users,
  public.seller_profiles,
  public.listings,
  public.reviews
FROM service_role;