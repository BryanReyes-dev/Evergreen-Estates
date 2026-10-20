-- Align the deployed review policies with src/db/schema.ts.
-- Treat a missing or empty application user ID as NULL.

DROP POLICY IF EXISTS "Users can create their own reviews"
ON public.reviews;
--> statement-breakpoint

CREATE POLICY "Users can create their own reviews"
ON public.reviews
AS PERMISSIVE
FOR INSERT
TO evergreen_app
WITH CHECK (
  user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
);
--> statement-breakpoint

DROP POLICY IF EXISTS "Users can update their own reviews"
ON public.reviews;
--> statement-breakpoint

CREATE POLICY "Users can update their own reviews"
ON public.reviews
AS PERMISSIVE
FOR UPDATE
TO evergreen_app
USING (
  user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
)
WITH CHECK (
  user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
);
--> statement-breakpoint

DROP POLICY IF EXISTS "Users can delete their own reviews"
ON public.reviews;
--> statement-breakpoint

CREATE POLICY "Users can delete their own reviews"
ON public.reviews
AS PERMISSIVE
FOR DELETE
TO evergreen_app
USING (
  user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
);
--> statement-breakpoint

DROP POLICY IF EXISTS "Owners can delete their seller profile"
ON public.seller_profiles;
--> statement-breakpoint

CREATE POLICY "Owners can delete their seller profile"
ON public.seller_profiles
AS PERMISSIVE
FOR DELETE
TO evergreen_app
USING (
  user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
);
--> statement-breakpoint

-- Preserve deterministic review IDs and timestamps during fixture inserts.
GRANT INSERT (id, created_at, updated_at)
ON TABLE public.reviews TO evergreen_app;