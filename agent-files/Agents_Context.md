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

The working branch is `main`.

Bryan prefers an incremental, local-first workflow:
1. Explain one focused change and why it is needed.
2. Let Bryan make the change locally.
3. Review the resulting diff and command output.
4. Run the relevant tests before proceeding.

Do not assume local edits are committed or pushed without confirmation.

## Implemented functionality

The repository source on `main` now contains significantly more than the earlier context described. This is a code inventory, not a security sign-off.

- Public listing browsing, listing details, URL-driven search/filtering, media presentation, and review display are implemented.
- Better Auth email/password authentication is configured against the canonical `public.users` table through `AUTH_DATABASE_URL` / `evergreen_auth`. Registration, sign-in, session retrieval, and sign-out were manually smoke-tested previously.
- Read-only listing queries use Drizzle through `DRIZZLE_DATABASE_URL` / `evergreen_runtime`.
- A dedicated writer connection exists in `src/db/drizzle/app-client.ts`; authenticated mutations use `withAppUserTransaction(userId, ...)`, which sets transaction-local `app.current_user_id`. The ID is supplied from the verified Better Auth session helper, not request JSON.
- Listing routes currently export GET and POST on `/api/v1/listings`, plus GET, PATCH, and DELETE on `/api/v1/listings/[id]`.
- Seller-profile routes currently export POST, GET, PATCH, and DELETE on `/api/v1/seller-profiles`.
- Review routes currently export GET/POST on `/api/v1/listings/[id]/reviews` and PATCH/DELETE in the nested review-item route. **Review-item PATCH/DELETE are not complete yet:** the folder is named `[id]` but the handler reads `params.reviewId`; rename that inner folder to `[reviewId]` so both listing `id` and review `reviewId` are available as distinct parameters.
- Listing media has authenticated upload-URL, upload-completion/registration, and deletion Route Handlers. The Storage bucket is intended to remain private; list media stores filenames and server-side code returns signed URLs.
- The application-write database role/policies are represented in migrations `0012`–`0016`. Their presence in Git does not prove those migrations have been applied to the current live database.
- The seed fixtures are implemented in `src/db/seed/data.ts`; **`scripts/populate.ts` does not exist yet**. The fixture defines four synthetic sellers, 12 listings, and 48 reviews, but only the first six listings have media filenames (14 listing media files in six folders). `seed/images/home-image.jpg` is a separate root asset, not part of listing fixture media.
- Existing tests cover fixture integrity and read-only runtime permissions. They do **not** provide dedicated Route Handler authorization coverage or app-writer/RLS/concurrency coverage. Bryan intends to complete the planned Vite+ migration before the final test phase.
- API error envelopes are not fully consistent: some handlers return `{ error: { code, message } }`, while others return a string-valued `error`. Normalize or explicitly document the contract as part of API sign-off.

## Database connections and security boundaries

- `DRIZZLE_DATABASE_URL` → `evergreen_runtime`, read-only application-table access.
- `AUTH_DATABASE_URL` → `evergreen_auth`, Better Auth identity, account, session, and verification operations.
- `DIRECT_URL` → privileged Drizzle Kit migrations only.
- `APP_DATABASE_URL` → `evergreen_app`, application-table mutations using the dedicated Drizzle writer client.
- `SUPABASE_SECRET_KEY` → server-only Storage administration for upload, inspection, and removal. It must never be exposed with a `NEXT_PUBLIC_` prefix.
- These values belong in local/private environment configuration only. Never place credentials or auth secrets in fixture data or commits.

Migration `0011_shared_read_role.sql` establishes shared read access through the `evergreen_read` role. Migrations `0012`–`0016` add owner-aware listing/profile/review policies, least-privilege application write grants, the database-enforced three-listings-per-seller cap, and review/profile deletion permissions. The current repository review did not independently query the live database to confirm the migrations through `0016` are applied; verify migration state and effective grants before executing population.

Two pre-population database-source gaps need resolution:

1. `drizzle/0016_enable_review_crud_and_seller_profile_delete.sql` creates review INSERT/UPDATE/DELETE and seller-profile DELETE policies, but the current `src/db/schema.ts` and `drizzle/meta/0016_snapshot.json` do not represent those policies. Reconcile the TypeScript schema/snapshot with the actual applied policy state before relying on future generated schema migrations; do not blindly regenerate duplicate policy creation SQL.
2. The existing app-role review INSERT grant covers `listing_id`, `user_id`, `rating`, and `comment`, but fixture reviews also define stable `id`, `createdAt`, and `updatedAt` values. To preserve all fixture fields when populating through `APP_DATABASE_URL`, add a new forward migration with the required narrow INSERT column privileges (or intentionally change the seeding contract to use database defaults and stop treating those fixture fields as persisted values).

The shared read role only exposes `users.id` and `users.name` through runtime read grants; auth operations use the dedicated auth role. Never use `DIRECT_URL` or `evergreen_auth` for application-table writes, and never use `evergreen_runtime` for mutations. The writer transaction must set its identity from the verified Better Auth session. RLS provides defense in depth, not protection from arbitrary SQL under a compromised writer credential.

## Latest schema state

Migration `0009_remove_redundant_schema_fields.sql` was generated, reviewed, and applied locally through Drizzle Kit. The live Supabase schema was independently checked afterward.

### `users`

- Canonical Better Auth identity table.
- `id` is the UUID primary key.
- `name`, `email`, `email_verified`, `image`, `created_at`, and `updated_at` remain.
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

The first six listings preserve their historical IDs, core details, and media filenames. Six additional listings have stable fixture IDs. The new listings currently have empty media arrays; assets can be added later.

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

## Immediate work order

### Current focus — population readiness (Monday, 2026-10-19)

The basic authentication integration and major REST mutation paths exist in source, and Bryan reports that the current baseline commands passed. That is enough to proceed with focused implementation work, **not** to declare CRUD security signed off or to run a population against the live database.

1. Fix the review item route parameter naming: rename `src/app/api/v1/listings/[id]/reviews/[id]/` to `src/app/api/v1/listings/[id]/reviews/[reviewId]/`. Keep the public URL unchanged; the handler already expects the names `id` and `reviewId`.
2. Reconcile the policies introduced by migration `0016` with `src/db/schema.ts` and Drizzle's current snapshot in a forward-safe way. Do not rewrite already-applied SQL migrations.
3. Add a new migration granting the app role only the extra review INSERT columns needed to persist fixture review IDs and timestamps, or explicitly revise the fixture/seeding contract to omit those fields. Preserve least privilege; do not expand grants on users/auth tables.
4. Add `APP_DATABASE_URL` to `.env.example` and document the dedicated `evergreen_app` connection. Ensure all runtime/auth/writer/migration credentials are distinct.
5. Implement the developer-only `scripts/populate.ts` using `src/db/seed/data.ts`. It must provision missing fixture seller accounts through Better Auth's supported server-side sign-up API; reuse only intended fixture identities on repeat runs; resolve canonical user UUIDs; create/reconcile seller profiles, 12 listings and 48 reviews; and upload only the fixture-referenced media paths to the private bucket.
6. Population must have a non-writing dry-run, explicit opt-in for writes, refuse production/preview environments, preflight required migrations/roles and asset availability, preserve unrelated rows/files, and never run at application startup or through a public endpoint. Use `APP_DATABASE_URL` plus per-owner transaction-local identity for owned app rows; use Better Auth for identities and the server-only Storage credential for media.
7. Existing media covers the first six fixture listings. Decide whether to create additional media for the six currently media-empty fixtures; don't silently add arbitrary assets or include the separate root `home-image.jpg` in listing media.
8. Defer the expanded automated API/auth/RLS suite until the planned Vite+ migration, as Bryan requested. That later verification must cover anonymous writes, malformed/forged owner input, cross-user read/write isolation, review-item PATCH/DELETE, database role grants/RLS, the three-listing concurrency limit, media lifecycle, seed repeatability, and final type/build/migration checks. Until then, static inspection and the user's reported baseline are not a substitute for security sign-off.

### After population and the final test phase

- Confirm the live development database has the expected migration state and inspect its initial row counts before writing.
- Run the population only against the explicitly selected non-production target and verify the expected four sellers/profiles, 12 listings, 48 reviews and each listing's registered media.
- Audit ownership completeness before making `listings.seller_user_id` non-null.
- Decide/implement aggregate-rating queries for cards and search results, then connect the UI to the verified endpoints.

## Media and implementation invariants

- Listing `media` arrays store filenames rather than public URLs.
- Media remains categorized as `image` or `video`; GIF is an image.
- `GetMediaUrls.ts` preserves database media order, appends files found in Storage but missing from the array, and generates signed URLs.
- Keep the Supabase Storage bucket private.
- Keep `src/lib/netlifyImageLoader.ts` and the local-development versus production image optimization behavior intact.
- Use the installed Next.js 16 documentation before framework-sensitive changes.