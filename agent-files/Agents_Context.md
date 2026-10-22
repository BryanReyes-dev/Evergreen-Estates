# Evergreen Estates — Working Context

> Current implementation status, verified findings, decisions, and immediate work order. ARCHITECTURE.md remains the authority for finalized architecture.

## Documentation authority

- `agent-files/ARCHITECTURE.md` is the authoritative architecture document.
- `agent-files/AGENTS.md` contains agent operating rules.
- `agent-files/CLAUDE.md` is the Claude entry point.
- Replace stale information rather than appending contradictory history.
- Distinguish implemented code from approved but unimplemented designs.

## Project and workflow

Evergreen Estates is a Next.js 16 App Router real-estate marketplace using TypeScript, React, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

The branch and working-tree state must be checked at the start of each task; this file does not record a durable current branch.

Bryan prefers an incremental, local-first workflow:
1. Explain one focused change and why it is needed.
2. Let Bryan make the change locally.
3. Review the resulting diff and command output.
4. Run the relevant tests before proceeding.

Do not assume local edits are committed or pushed without confirmation.

## Implemented functionality

- Public listing browsing, listing details, URL-driven search/filtering, review display, and media presentation.
- Listing read queries in `src/db/queries/listings.ts` use Drizzle.
- `DRIZZLE_DATABASE_URL` connects through the read-only `evergreen_runtime` role.
- Supabase JS is used for Storage operations rather than application-table queries.
- Better Auth email/password authentication is integrated with the canonical `public.users` table.
- `AUTH_DATABASE_URL` connects through the restricted `evergreen_auth` role.
- Auth tables are `account`, `session`, and `verification`.
- Auth endpoints live at `/api/auth/[...all]`.
- Route Handlers present in source: listing collection GET/POST; listing item GET/PATCH/DELETE; seller-profile GET/POST/PATCH/DELETE; review collection GET/POST; review item PATCH/DELETE using `[reviewId]`; and listing-media upload-url POST, completion POST, and file DELETE.
- The current branch connects the user-facing auth, profile, listing CRUD, review CRUD, media management, and published seller storefront flows to these APIs. Source presence does not establish successful runtime behavior or deployment; static and manual verification remain outstanding.
- Auth registration, sign-in, session retrieval, and sign-out were manually tested previously.
- APP_DATABASE_URL support and a writer Drizzle client, grants, and owner-aware policies are present locally. Treat their deployment and behavior as unverified until migrations and authorization tests are confirmed.

## Database connections and security boundaries

- `DRIZZLE_DATABASE_URL` → `evergreen_runtime`, read-only application-table access.
- `AUTH_DATABASE_URL` → `evergreen_auth`, Better Auth identity and auth-table operations.
- `DIRECT_URL` → privileged Drizzle Kit migrations only.
- `APP_DATABASE_URL` → current local app write client uses `evergreen_app`; deployment configuration is unverified.

The shared `evergreen_read` NOLOGIN role and migration-defined memberships/grants are in repository history. `evergreen_runtime` and `evergreen_app` inherit shared reads using `INHERIT TRUE, SET FALSE`. Migration `0011_shared_read_role.sql` grants SELECT on listings/reviews/seller_profiles and only users.id/users.name. The current checkout adds app write grants/policies in migrations 0013–0018 and a transaction-scoped app client. These files do not establish which migrations are applied to a live service.

PostgreSQL 17.6 verification on 2026-10-18 predates the app-write grants and policies in migrations 0013–0018. It confirmed shared reads and that `evergreen_runtime` could not select `users.email`; its finding that the app role lacked listing-write privileges is historical and should not be used to describe the current migration set. The four shared-read policies target `evergreen_read`, and the separate `evergreen_auth` policy on users remains in place. Current effective privileges still need verification against the target database.

Never use the runtime or auth roles for migrations. Never use `DIRECT_URL` in request handlers. Keep credentials and Better Auth secrets server-only. Do not grant general listing-write permissions to `evergreen_runtime` or `evergreen_auth`.

## Latest schema state

Migration `0009_remove_redundant_schema_fields.sql` was generated, reviewed, and applied locally through Drizzle Kit. The live Supabase schema was independently checked afterward.

### `users`

- Canonical Better Auth identity table.
- `id` is the UUID primary key.
- `name`, `email`, `email_verified`, `image`, `created_at`, and `updated_at` remain.
- Migration 0019 adds private `saved_listings uuid[]` with a database-enforced 100-ID maximum; it is not yet applied to the live database.
- `email` is unique.
- Removed `auth_user_id`; Better Auth uses `users.id`.

### `seller_profiles`

- `user_id` is both primary key and foreign key to `users.id`.
- `display_name` is required.
- `bio`, `avatar_url`, `contact_email`, and `contact_phone` may be null.
- `preferred_contact_method` is required, has no default, and accepts `email` or `phone`.
- The check constraint requires `contact_email` when the preference is `email`, or `contact_phone` when the preference is `phone`.
- `is_published`, `created_at`, and `updated_at` remain.
- Removed `slug`.

The presence of a seller profile establishes seller eligibility. `is_published` controls public storefront visibility; it is not the seller-role flag.

### `listings`

- `id`, `media`, `tags`, `title`, `price`, `beds`, `baths`, `sqft`, `address`, `description`, `created_at`, `seller_user_id`, and `updated_at` remain.
- `created_at` is now non-null.
- Removed `stars`; ratings must be derived from reviews.
- Removed `seller`; seller display data should come from the related seller profile.
- `seller_user_id` remains nullable temporarily because no fixture owners have been populated yet.
- `seller_user_id` references `seller_profiles.user_id` and has its ownership index.
- New listing creation must require a valid owner. Do not make the database column non-null until all retained/seeded listings have valid owners and the migration is planned.

### `reviews`

- Each review references a listing and a user.
- Ratings are constrained to integer values from 1 through 5.
- The unique `(listing_id, user_id)` constraint allows one review per user per listing.
- The review records are the source of truth for average ratings and review counts.
- Listings without reviews should show an empty-rating state rather than `0.0★`.

The Better Auth `account`, `session`, and `verification` tables remain unchanged.

Historical migrations and snapshots are preserved. Do not rewrite old migration files to reflect the current schema.

## Live database cleanup — verified

The old mock records were cleared from the live database before migration `0009` was applied.

Latest verified counts immediately after cleanup and migration:

| Data | Count |
|---|---:|
| Listings | 0 |
| Reviews | 0 |
| Seller profiles | 0 |
| Users | 1 |
| Better Auth accounts | 1 |
| Better Auth sessions | 1 |
| Verification records | 0 |
| Storage objects in `property-images` | 15 |

The remaining user/account/session is the separate `Evergreen Test` identity from manual auth testing. It is not an intended fixture account.

The legacy reviewer-only rows were removed from the live database, but their original values and review relationships remain in the historical snapshot.

## Historical snapshot and media preservation

- `seed/snapshots/existing-mock-data.json` is the immutable historical archive of the old database state.
- It records the six original listings, three old reviews, three legacy reviewer identities, and 15 Storage objects.
- Do not turn this historical snapshot into the intended seed dataset or edit it to match the new schema.
- The downloaded Storage assets remain under `seed/images/`.
- All 15 original Storage objects, totalling 39,998,905 bytes, were downloaded and verified locally.
- The private `property-images` bucket still contains 15 objects.
- Fourteen objects are under `listings/<listing-id>/<filename>` and one object, `home-image.jpg`, is at the bucket root.
- Do not make the bucket public or replace signed URLs with public local media URLs.

The app uses `src/db/supabase/util/GetMediaUrls.ts` to generate signed URLs for private Storage objects. Keep this runtime design unchanged.

## Intended fixture dataset — definitions and validation implemented

`src/db/seed/data.ts` defines the intended new mock dataset. It contains fixtures only; it does not write to the database or provision authentication accounts.

`tests/data.test.ts` validates the fixture data.

The intended dataset is:

| Data | Count |
|---|---:|
| Login-capable synthetic sellers | 4 |
| Seller profiles | 4 |
| Listings | 12 |
| Listings per seller | 3 |
| Reviews authored by the sellers | 48 |

All four sellers review all twelve listings, including their own listings. Self-reviews are intentionally allowed in this mock dataset.

Review fixture authors use stable seller keys. The population process must resolve those keys to the actual user UUIDs created for the Better Auth accounts.

The first six listings preserve their historical IDs, core details, and media filenames. Six additional listings have stable fixture IDs. All 12 fixture listings now reference four local media assets each: two JPGs, one GIF, and one MP4 (48 assets total).

The intended dataset contains only the four seller identities as users. The three old reviewer identities and their three reviews remain archived, but are not duplicated into the new 48-review dataset.

Seller fixture definitions contain no passwords, hashes, sessions, database credentials, or secrets. Login-capable seller accounts must be provisioned using a supported Better Auth flow.

Ratings must be calculated from reviews. Do not reintroduce a `stars` field into listing fixtures or the schema.

### Validation results

Bryan reported the following checks passing after the latest fixture edits:

- `npx tsc --noEmit`
- `npx vitest run tests/data.test.ts`
- `npm run test:run`

The fixture-specific suite passed all 9 tests. The full suite passed 11 tests across 2 files, including the existing runtime database-permissions tests.

These are user-reported command results. Re-run relevant checks after additional edits.

## Current implementation status (2026-10-21)

The pushed repository now includes:

- Public listing browsing, details, and URL-driven search/filtering.
- Better Auth email/password backend plus user-facing sign-up/sign-in and session-aware account navigation.
- Seller-profile create/read/update/delete UI connected to the existing seller-profile API, plus a public storefront page for profiles explicitly marked published.
- Listing create/edit/delete UI connected to the existing listing Route Handlers, with owner-scoped edit access and a seller page listing the current user's properties.
- Review create/edit/delete controls connected to the existing review Route Handlers; only the review author sees mutation controls, and the server remains authoritative.
- Listing media upload, preview, reorder, and deletion UI connected to the media endpoints.
- Saved-home buttons on listing cards and details, Saved homes page, and GET/PATCH `/api/v1/users/me/saved-listings` backed by migration 0019.
- Synthetic fixtures and 48 local media files, plus scripts/populate.ts with read-only preflight and explicit write-mode safeguards.

These source changes have not yet been type-checked, built, automated-tested, or manually verified as end-to-end workflows in this implementation pass. Do not describe them as validated until those steps run successfully.

### Population script status

- `npm run populate:dry-run` invokes the population script in read-only mode.
- The updated preflight requires migration 0019's saved-list column and 100-item CHECK constraint, verifies app/auth role grants and saved-list RLS policies, and verifies the listing-delete cleanup trigger. It will stop against the live database until migration 0019 is applied.
- Dry-run does not require the private synthetic-seller credentials file; credentials are read only when apply mode would need to create accounts.
- Apply mode requires explicit project confirmation and remains blocked by the known unresolved 0011 shared-read migration checksum/provenance discrepancy. Do not bypass the guard or modify the Drizzle ledger to force population.
- The dry-run must still be executed and its report reviewed. Existing Storage objects must be byte-compared with local fixtures, and unrelated Storage objects must remain untouched.
- The database population operation has not been run by this pass.

### Next work order

1. Review this branch and run TypeScript, ESLint, and the production build; these were not run in this pass.
2. Review and apply migration 0019 through the normal migration workflow in the intended environment, then manually verify saved homes.
3. Manually verify auth, profile, listing CRUD, reviews, saved-home save/unsave/persistence, Saved page states, media management, mobile navigation, and error states with at least two accounts.
4. Run the documented population dry-run after migration 0019 is applied. Keep population apply blocked until migration 0011 provenance and any genuine Storage byte conflicts are resolved.
4. Update any findings in this context/architecture documentation.
5. Keep Vite+ as the last implementation-stage change. Automated tests and the final security audit remain deferred until after Vite+ as requested; preserve Next.js as the runtime unless a separate framework conversion is approved.
6. After the Vite+ work, add/expand automated tests and conduct the final security audit.

Saved homes source is now implemented in this branch: migration 0019, GET/PATCH route, shared saved-state provider, card/detail save controls, and Saved homes page. Migration 0019 has not been applied to live Supabase, and the workflow has not been manually verified. Public seller storefronts are implemented for profiles explicitly marked published. Rating aggregates on listing cards/search results also remain a separate UI/data enhancement; listing details calculate the average from the review records they load and display an unrated state when there are no reviews.

agent-files/ARCHITECTURE.md remains the finalized architecture authority; this context records status and verification boundaries.

## Media and implementation invariants

- Listing `media` arrays store filenames rather than public URLs.
- Media remains categorized as `image` or `video`; GIF is an image.
- `GetMediaUrls.ts` preserves database media order, filters out filenames absent from Storage, and generates signed URLs through the server-only Storage admin helper.
- Keep the Supabase Storage bucket private.
- Keep `src/lib/netlifyImageLoader.ts` and the local-development versus production image optimization behavior intact.
- Use the installed Next.js 16 documentation before framework-sensitive changes.
