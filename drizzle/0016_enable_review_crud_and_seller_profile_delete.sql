-- Seller profiles: allow users to delete only their own profile.
GRANT DELETE ON TABLE public.seller_profiles TO evergreen_app;

CREATE POLICY "Owners can delete their seller profile"
ON public.seller_profiles
FOR DELETE
TO evergreen_app
USING (
  user_id = current_setting('app.current_user_id', true)::uuid
);

-- Reviews: allow authenticated owners to create their own reviews.
GRANT INSERT (listing_id, user_id, rating, comment)
ON TABLE public.reviews TO evergreen_app;

CREATE POLICY "Users can create their own reviews"
ON public.reviews
FOR INSERT
TO evergreen_app
WITH CHECK (
  user_id = current_setting('app.current_user_id', true)::uuid
);

-- Reviews: allow users to update only their own reviews.
GRANT UPDATE (rating, comment, updated_at)
ON TABLE public.reviews TO evergreen_app;

CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
TO evergreen_app
USING (
  user_id = current_setting('app.current_user_id', true)::uuid
)
WITH CHECK (
  user_id = current_setting('app.current_user_id', true)::uuid
);

-- Reviews: allow users to delete only their own reviews.
GRANT DELETE ON TABLE public.reviews TO evergreen_app;

CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
TO evergreen_app
USING (
  user_id = current_setting('app.current_user_id', true)::uuid
);