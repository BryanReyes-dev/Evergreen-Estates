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
- Listing GET/POST handlers exist at `/api/v1/listings` and GET exists at `/api/v1/listings/[id]`; listing PATCH/DELETE are not present in the current checkout.
- Seller-profile CRUD and review create/update/delete handlers are present locally. The review item parameter is `[reviewId]`.
- Auth registration, sign-in, session retrieval, and sign-out were manually tested previously.
- APP_DATABASE_URL support and a writer Drizzle client, grants, and owner-aware policies are present locally. Treat their deployment and behavior as unverified until migrations and authorization tests are confirmed.

## Database connections and security boundaries

- `DRIZZLE_DATABASE_URL` → `evergreen_runtime`, read-only application-table access.
- `AUTH_DATABASE_URL` → `evergreen_auth`, Better Auth identity and auth-table operations.
- `DIRECT_URL` → privileged Drizzle Kit migrations only.
- `APP_DATABASE_URL` → current local app write client uses `evergreen_app`; deployment configuration is unverified.

The shared `evergreen_read` NOLOGIN role and migration-defined memberships/grants are in repository history. `evergreen_runtime` and `evergreen_app` inherit shared reads using `INHERIT TRUE, SET FALSE`. Migration `0011_shared_read_role.sql` grants SELECT on listings/reviews/seller_profiles and only users.id/users.name. The current checkout adds app write grants/policies in migrations 0013–0018 and a transaction-scoped app client. These files do not establish which migrations are applied to a live service.

PostgreSQL 17.6 verification on 2026-10-18 confirmed both login roles can read listings; the app role cannot INSERT or UPDATE listings; the runtime role cannot select users.email; all four shared-read policies target `evergreen_read`. The separate `evergreen_auth` policy on users remains in place.

Never use the runtime or auth roles for migrations. Never use `DIRECT_URL` in request handlers. Keep credentials and Better Auth secrets server-only. Do not grant general listing-write permissions to `evergreen_runtime` or `evergreen_auth`.

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

## Current status and follow-up (2026-10-20)

This checkout has uncommitted implementation changes. It includes listing creation, seller-profile CRUD, review create/update/delete, the app writer client, migrations for scoped grants/policies, and migration 0018 removing public Storage reads. Listing PATCH/DELETE and `scripts/populate.ts` are absent. File presence does not establish that the changes are complete, tested, or deployed.

Fixtures define four synthetic sellers, 12 listings (three each), and 48 reviews. `tests/data.test.ts` validates fixtures; there is no database population operation. The three-listing cap is implemented in migration 0013 with a database trigger and advisory lock, but runtime behavior was not verified during this documentation audit. Historical test results below are user-reported and were not rerun.

Before relying on local write behavior, review its authorization and validation paths, test the handlers and role boundaries, and confirm the migrations and role settings against the target database. Do not populate a database as part of this status.

### Historical next-work notes (2026-10-18/19)

The current API already uses the correct Next.js App Router Route Handler convention for the GET endpoints. These are proper HTTP endpoints; a separate Express server is not needed. The remaining work is mutation handlers and security, not replacing the existing GET routes.

| Method and path | Status | Planned behavior |
|---|---|---|
| GET /api/v1/listings | Implemented | Public listing collection with price/query/tag filters |
| POST /api/v1/listings | Planned | Create listing for the authenticated seller |
| GET /api/v1/listings/[id] | Implemented | Public listing detail; preserve current 404 behavior |
| PATCH /api/v1/listings/[id] | Planned | Partially update an owned listing |
| DELETE /api/v1/listings/[id] | Planned | Delete an owned listing |
| POST /api/v1/seller-profiles | Planned | Create a seller profile for the authenticated user |

The collection methods belong in src/app/api/v1/listings/route.ts; item methods belong in src/app/api/v1/listings/[id]/route.ts. Add exported method functions to the existing route.ts files rather than creating one file per method. Use PATCH for partial updates; do not add PUT unless we intentionally design full replacement semantics.

Implementation order:

1. Add a server-only Drizzle app client using APP_DATABASE_URL and evergreen_app. The login already exists and inherits shared reads, but it currently has no table-write grants.
2. Add the app-specific grants and owner-aware RLS policies for only the required INSERT/UPDATE/DELETE operations. Add a policy for a seller to read/manage their own unpublished profile without exposing all unpublished profiles. Keep users and Better Auth tables outside the app writer's write scope.
3. Implement Route Handler session checks, payload validation, and JSON/status behavior, delegating SQL to src/db mutation modules. Derive seller identity from the verified Better Auth session, never request JSON. Reject or ignore ownership fields supplied by clients.
4. Implement seller-profile onboarding tied to the canonical users.id; listing creation must require that profile.
5. Enforce the three-active-listings-per-seller limit with concurrency-safe database logic rather than a client-only check or a plain count-then-insert.
6. Preserve the current GET routes and GET-by-ID 404 behavior. Keep handlers thin; Server Component reads should go directly through the query layer instead of self-fetching the API.

Use the established response envelope: { data: ... } for success and { error: { code, message } } for errors. Aim for 201 on creation, 200 on read/update, 204 for a delete with no body, 400 for invalid payloads, 401 for unauthenticated mutation requests, 404 for missing/non-owned listings, 409 for business-rule conflicts, and a generic client-safe 500 for unexpected failures.

Before any write handler is enabled, verify anonymous writes fail, invalid input is rejected, cross-user update/delete and owner reassignment are blocked, own unpublished profiles are accessible only to that user, and concurrent creates cannot exceed the listing cap.

### Next work session — Monday, 2026-10-19

1. Expand/run Vitest tests for Route Handler payload/status behavior, authenticated session requirements, ownership isolation, database role grants/RLS, and concurrency-safe listing limits. The repository uses Vitest (npm run test:run).
2. Implement scripts/populate.ts only once CRUD ownership/security and schema decisions are stable. Import fixtures from src/db/seed/data.ts; provision the four synthetic seller accounts through a supported Better Auth flow; resolve UUID relationships; insert/reconcile the twelve listings and 48 reviews; upload assets to the private property-images bucket.
3. Make population repeatable without duplicate fixture-managed records; report inserts/updates/skips and validation failures; avoid deleting unrelated data by default; guard explicitly against production and never run from app startup/public routes.
4. Re-run npx tsc --noEmit, relevant Vitest suites, npm run build, npx drizzle-kit check, and migration/permission checks after changes. Earlier passing test results are historical until rerun.

### After REST CRUD and population

- Audit ownership completeness before making listings.seller_user_id non-null.
- Decide/implement rating aggregate queries for cards and search results.
- Connect UI mutations to the tested endpoints and verify the end-to-end experience.

## Media and implementation invariants

- Listing `media` arrays store filenames rather than public URLs.
- Media remains categorized as `image` or `video`; GIF is an image.
- `GetMediaUrls.ts` preserves database media order, filters out filenames absent from Storage, and generates signed URLs through the server-only Storage admin helper.
- Keep the Supabase Storage bucket private.
- Keep `src/lib/netlifyImageLoader.ts` and the local-development versus production image optimization behavior intact.
- Use the installed Next.js 16 documentation before framework-sensitive changes.
