-- The application role must be able to verify any listing before saving it.
-- The route takes a KEY SHARE lock in the same transaction to serialize the
-- save operation against listing deletion. Keep this policy targeted at the
-- server-only write role; do not grant broad access to public API roles.
DROP POLICY IF EXISTS "App can read listings for saved homes" ON public.listings;
--> statement-breakpoint

CREATE POLICY "App can read listings for saved homes"
ON public.listings
AS PERMISSIVE
FOR SELECT
TO evergreen_app
USING (true);
