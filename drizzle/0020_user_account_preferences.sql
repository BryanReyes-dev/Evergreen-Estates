-- Account preferences are owner-private. Public reads may resolve only the user's avatar.
ALTER TABLE public.users
  ADD COLUMN preferences jsonb NOT NULL
  DEFAULT '{"defaultSort":"newest","viewMode":"grid"}'::jsonb;
--> statement-breakpoint

ALTER TABLE public.users
  ADD CONSTRAINT users_preferences_valid_check
  CHECK (
    jsonb_typeof(preferences) = 'object'
    AND preferences ? 'defaultSort'
    AND preferences ? 'viewMode'
    AND preferences->>'defaultSort' IN ('newest', 'price-low', 'price-high')
    AND preferences->>'viewMode' IN ('grid', 'list')
  );
--> statement-breakpoint

-- Preserve legacy seller photos as account avatars when the account has no image yet.
UPDATE public.users AS account_user
SET image = seller_profiles.avatar_url
FROM public.seller_profiles
WHERE seller_profiles.user_id = account_user.id
  AND account_user.image IS NULL
  AND seller_profiles.avatar_url ~* '^https?://[^[:space:]]+
GRANT SELECT (id, name, image) ON TABLE public.users TO evergreen_read;
--> statement-breakpoint
GRANT SELECT (preferences) ON TABLE public.users TO evergreen_app;
--> statement-breakpoint
GRANT UPDATE (image, preferences, updated_at) ON TABLE public.users TO evergreen_app;
;
--> statement-breakpoint

-- Public identity includes only name and avatar; preferences remain private to the owner.
GRANT SELECT (id, name, image) ON TABLE public.users TO evergreen_read;
--> statement-breakpoint
GRANT SELECT (preferences) ON TABLE public.users TO evergreen_app;
--> statement-breakpoint
GRANT UPDATE (image, preferences, updated_at) ON TABLE public.users TO evergreen_app;
