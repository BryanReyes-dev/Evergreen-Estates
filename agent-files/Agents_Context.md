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

- Public listing browsing, listing details, URL-driven search/filtering, review display, and media presentation.
- Listing read queries in `src/db/queries/listings.ts` use Drizzle.
- `DRIZZLE_DATABASE_URL` connects through the read-only `evergreen_runtime` role.
- Supabase JS is used for Storage operations rather than application-table queries.
- Better Auth email/password authentication is integrated with the canonical `public.users` table.
- `AUTH_DATABASE_URL` connects through the restricted `evergreen_auth` role.
- Auth tables are `account`, `session`, and `verification`.
- Auth endpoints live at `/api/auth/[...all]`.
- Listing GET endpoints exist at `/api/v1/listings` and `/api/v1/listings/[id]`.
- Auth registration, sign-in, session retrieval, and sign-out were manually tested previously.
- Listing CRUD writes, seller onboarding, and the dedicated application-write role are not implemented yet.

## Database connections and security boundaries

- `DRIZZLE_DATABASE_URL` → `evergreen_runtime`, read-only application-table access.
- `AUTH_DATABASE_URL` → `evergreen_auth`, Better Auth identity and auth-table operations.
- `DIRECT_URL` → privileged Drizzle Kit migrations only.
- `APP_DATABASE_URL` and the `evergreen_app` write role/client are planned, not implemented.

Never use the runtime or auth roles for migrations. Never use `DIRECT_URL` in request handlers. Keep credentials and Better Auth secrets server-only.

Do not grant general listing-write permissions to `evergreen_runtime` or `evergreen_auth`.

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

### Documentation alignment completed

The architecture and agent operating documents have been updated on `main` to reflect the current schema, cleared mock-data tables, immutable historical snapshot, implemented fixtures, 15-object Storage inventory, and still-planned population workflow. Pull these documentation changes before starting the next implementation step.

### 1. Implement secure listing CRUD and seller onboarding

Before populating the database:

- Add a dedicated least-privilege writer connection, `APP_DATABASE_URL` / `evergreen_app`.
- Keep runtime reads, Better Auth operations, and migrations on their existing separate connections.
- Implement authenticated listing POST/PATCH/DELETE handlers.
- Verify the Better Auth session on the server.
- Resolve listing owner identity from the verified session, never from a browser-supplied user ID.
- Implement seller profile onboarding associated with the authenticated `users.id`.
- Enforce owner-only updates/deletes.
- Enforce the three-active-listings-per-seller cap with concurrency-safe handling.
- Add appropriate RLS policies and limited table grants.
- Test anonymous access, invalid input, cross-user mutations, owner reassignment, and concurrent listing creation.

The writer role/client and owner-aware listing-write policies are not implemented yet. Do not enable write handlers until their authorization boundaries are tested.

### 2. Audit and finalize schema constraints

After fixture and CRUD dependencies are aligned:

- Ensure listing ownership is set for every intended listing.
- Make `listings.seller_user_id` non-null in a subsequent migration only after verifying every retained row has a valid owner.
- Decide and implement the rating aggregate queries needed by listing cards/search results as well as detail pages.
- Keep historical migrations/snapshots immutable.

### 3. Implement the population function

Only after the schema, seller onboarding, and ownership/write behavior are stable, implement `scripts/populate.ts` importing `src/db/seed/data.ts`.

Population should:

- Provision the four seller accounts through Better Auth without committing reusable credentials.
- Resolve user UUIDs and create the corresponding seller profiles.
- Insert or safely reconcile the twelve listings and 48 reviews.
- Upload bundled media to the private `property-images` bucket.
- Be repeatable without duplicate fixture records.
- Report inserts/updates/skips and validation failures.
- Avoid deleting unrelated data by default.
- Guard explicitly against accidentally targeting production.
- Never run automatically at app startup or through a public route.

### 4. Wire CRUD into the UI and verify end to end

After the write path and population workflow are implemented, connect the UI and rerun type-checks, full tests, build, migration checks, and targeted authorization tests.

## Media and implementation invariants

- Listing `media` arrays store filenames rather than public URLs.
- Media remains categorized as `image` or `video`; GIF is an image.
- `GetMediaUrls.ts` preserves database media order, appends files found in Storage but missing from the array, and generates signed URLs.
- Keep the Supabase Storage bucket private.
- Keep `src/lib/netlifyImageLoader.ts` and the local-development versus production image optimization behavior intact.
- Use the installed Next.js 16 documentation before framework-sensitive changes.