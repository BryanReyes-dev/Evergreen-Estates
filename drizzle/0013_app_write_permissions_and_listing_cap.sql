-- Listing creation: allow only the required columns.
-- id/created_at/updated_at are included so the trusted population
-- script can preserve stable fixture IDs and timestamps later.
GRANT INSERT (
  id,
  media,
  tags,
  title,
  price,
  beds,
  baths,
  sqft,
  address,
  description,
  created_at,
  updated_at,
  seller_user_id
)
ON TABLE public.listings TO evergreen_app;
--> statement-breakpoint

-- Listing edits cannot change the ID or transfer ownership.
GRANT UPDATE (
  media,
  tags,
  title,
  price,
  beds,
  baths,
  sqft,
  address,
  description
)
ON TABLE public.listings TO evergreen_app;
--> statement-breakpoint

GRANT DELETE ON TABLE public.listings TO evergreen_app;
--> statement-breakpoint

-- Seller onboarding and profile edits.
-- user_id is insertable but not updateable, preventing reassignment.
GRANT INSERT (
  user_id,
  display_name,
  bio,
  avatar_url,
  contact_email,
  contact_phone,
  preferred_contact_method,
  is_published
)
ON TABLE public.seller_profiles TO evergreen_app;
--> statement-breakpoint

GRANT UPDATE (
  display_name,
  bio,
  avatar_url,
  contact_email,
  contact_phone,
  preferred_contact_method,
  is_published
)
ON TABLE public.seller_profiles TO evergreen_app;
--> statement-breakpoint

-- Enforce a maximum of three listings per seller.
-- The transaction advisory lock serializes competing changes
-- for the same seller. VOLATILE allows the count query to see
-- newly committed rows after waiting for the lock at READ COMMITTED.
CREATE OR REPLACE FUNCTION public.enforce_max_three_listings_per_seller()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  existing_count bigint;
BEGIN
  IF NEW.seller_user_id IS NULL THEN
    RAISE EXCEPTION 'A listing must have a seller owner.'
      USING ERRCODE = '23502',
            COLUMN = 'seller_user_id';
  END IF;

  -- Regular edits to an existing listing do not use another slot.
  IF TG_OP = 'UPDATE'
     AND OLD.seller_user_id IS NOT DISTINCT FROM NEW.seller_user_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.seller_user_id::text, 0)
  );

  IF TG_OP = 'UPDATE' THEN
    SELECT count(*)
      INTO existing_count
      FROM public.listings AS listing
     WHERE listing.seller_user_id = NEW.seller_user_id
       AND listing.id <> OLD.id;
  ELSE
    SELECT count(*)
      INTO existing_count
      FROM public.listings AS listing
     WHERE listing.seller_user_id = NEW.seller_user_id;
  END IF;

  IF existing_count >= 3 THEN
    RAISE EXCEPTION 'A seller may own at most three listings.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'listings_max_three_per_seller';
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint

-- The application role must not bypass RLS or call the trigger
-- function directly as an ordinary SQL function.
REVOKE ALL
ON FUNCTION public.enforce_max_three_listings_per_seller()
FROM PUBLIC;
--> statement-breakpoint

CREATE TRIGGER listings_enforce_max_three_per_seller
BEFORE INSERT OR UPDATE OF seller_user_id
ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_max_three_listings_per_seller();