# Evergreen Estates Architecture

## Document Authority

This is the authoritative record of finalized Evergreen Estates architecture. Proposed designs that are not implemented must be labeled as planned.

- `agent-files/Agents_Context.md` records current implementation status, verified findings, and the immediate work order.
- `agent-files/AGENTS.md` contains operating rules for coding agents.
- `agent-files/CLAUDE.md` includes the agent rules, context, and this architecture file.
- Never describe planned code as implemented. Replace stale instructions instead of adding contradictory history.

## 1. Project Identity and Stack

Evergreen Estates is a real-estate marketplace built with Next.js 16.x App Router, React, TypeScript, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

Implemented functionality includes public property browsing, listing details, URL-driven search/filtering, listing media and review display, Better Auth email/password authentication, listing POST/PATCH/DELETE handlers, seller-profile POST/GET/PATCH/DELETE handlers, review list GET/POST, review item PATCH/DELETE handlers, and listing-media upload/registration/deletion handlers. The review-item update/delete route has a known parameter-name defect documented in Section 6, so those two operations are not considered signed off. Automated API authorization coverage is not yet present.

## 2. Application Structure and Boundaries

```
src/
├── app/          pages, layouts, Route Handlers, server/client boundaries
├── components/   reusable UI and feature components
├── db/           Drizzle schemas, queries, clients, seed fixtures, Storage helpers
└── lib/          shared utilities and Better Auth configuration

agent-files/      coding-agent guidance, context, and architecture authority
drizzle/          SQL migrations and Drizzle Kit metadata
scripts/          planned developer-run population entry point
seed/
├── images/       downloaded source media
└── snapshots/    immutable historical database snapshot
```

Keep application-table query and write logic behind the `src/db` boundary. Server Components are the default for data fetching and rendering. Client Components are for browser-only behavior such as event handlers, interactive state, animation, client navigation, and Embla interaction.

Explicit HTTP APIs live in Next.js Route Handlers under `src/app/api`. A client-side check is not authorization: mutating handlers must verify the Better Auth session on the server, validate input, enforce business rules, and call narrowly scoped database operations.

## 3. Database Connections and Credentials

The application uses separate credentials for distinct responsibilities:

| Environment variable | Database role | Purpose | State |
|---|---|---|---|
| `DRIZZLE_DATABASE_URL` | `evergreen_runtime` | Read-only application-table queries | Implemented |
| `AUTH_DATABASE_URL` | `evergreen_auth` | Better Auth user, account, session, and verification operations | Implemented |
| `APP_DATABASE_URL` | `evergreen_app` | Least-privilege application writes in user-scoped transactions | Client implemented; grants/policies are in migrations 0012–0016 |
| `DIRECT_URL` | Privileged migration connection | Drizzle Kit migrations only | Implemented |

The NOLOGIN `evergreen_read` role holds common SELECT privileges. Migration 0011 grants membership to `evergreen_runtime` and `evergreen_app` with `INHERIT TRUE, SET FALSE`. The runtime role remains read-only. Migrations 0012–0016 add targeted writer grants, owner-aware RLS policies, the three-listing database cap, and review/profile-delete permissions.

`src/db/drizzle/app-client.ts` implements a server-only writer. Mutations must use `withAppUserTransaction` with the canonical UUID from a verified Better Auth session; the helper sets `app.current_user_id` only for the active transaction. Never accept the user ID from request payloads or use the app role without its owner context for application mutations.

**Schema tracking caveat:** migration 0016 adds policies for review INSERT/UPDATE/DELETE and seller-profile DELETE, but these policies are absent from `src/db/schema.ts` and `drizzle/meta/0016_snapshot.json`. Safely reconcile source/snapshot metadata with the actual applied policy state before the next Drizzle-generated schema migration. Do not modify applied SQL migrations or blindly generate duplicate CREATE POLICY statements.

Never use `DIRECT_URL` in a request handler. Do not grant general listing writes to `evergreen_runtime` or `evergreen_auth`. All database URLs and Better Auth/Storage secrets must remain server-only; never expose them through `NEXT_PUBLIC_` variables. Supabase JS is used for private Storage operations, not application-table queries. Database clients disable postgres.js prepared statements for compatibility with the Supabase shared transaction pooler.

## 4. Current Schema

The schema source is src/db/schema.ts, with Better Auth tables defined in src/db/auth-schema.ts. Migration history is versioned under drizzle/. Do not rewrite historical migrations to make them resemble the current schema.

src/db/schema.ts declares evergreenReadRole via pgRole and targets it from the four common SELECT RLS policies. The applied role/membership/grant transition is migration 0011; keep future schema-policy changes generated and reviewed, with explicit custom SQL reserved for grants or memberships Drizzle cannot express.

### `users`

- Canonical Better Auth identity table; there is no separate Better Auth user table.
- UUID `id` primary key; `name`, unique `email`, `email_verified`, nullable `image`, `created_at`, and `updated_at`.
- `users.auth_user_id` was removed by migration `0009_remove_redundant_schema_fields.sql`. Do not refer to it as a current column or reintroduce it.
- Runtime column grants restrict user identity reads; the application should return only public fields needed by the caller.

### `seller_profiles`

- `user_id` is both the primary key and a foreign key to `users.id`.
- `display_name` and `preferred_contact_method` are required.
- `bio`, `avatar_url`, `contact_email`, and `contact_phone` may be null.
- `preferred_contact_method` accepts `email` or `phone`; the check constraint requires the corresponding contact field.
- `is_published`, `created_at`, and `updated_at` remain.
- The presence of a seller profile establishes seller eligibility. `is_published` controls public storefront visibility; it is not the seller-role flag.
- The legacy `slug` column was removed by migration 0009.

### `listings`

- Current columns: `id`, `media`, `tags`, `title`, `price`, `beds`, `baths`, `sqft`, `address`, `description`, `created_at`, `seller_user_id`, and `updated_at`.
- `created_at` and `updated_at` are non-null.
- `seller_user_id` references `seller_profiles.user_id` and has an ownership index. It remains nullable temporarily; do not make it non-null until every retained/populated listing has a valid owner and a migration is planned.
- New listing creation must require a valid owner. The owner is always derived from the verified session, never accepted from the request body.
- The old denormalized `seller` and `stars` columns were removed by migration 0009. Seller display data belongs to seller profiles; rating aggregates must be derived from reviews.

### `reviews`

- Each review references a listing and a user.
- Ratings are constrained to integers from 1 through 5.
- Unique `(listing_id, user_id)` allows one review per user per listing.
- Review rows are the source of truth for average ratings and review counts. Listings without reviews should show an empty-rating state rather than `0.0★`.

### Better Auth tables

The `account`, `session`, and `verification` tables are defined in `src/db/auth-schema.ts`. Better Auth is configured in `src/lib/auth.ts`, uses the dedicated `evergreen_auth` connection, and exposes same-origin browser authentication through `src/lib/auth-client.ts` and `src/app/api/auth/[...all]/route.ts`.

Email/password registration, sign-in, session retrieval, and sign-out were manually tested locally. These checks validate the basic auth flow, not CRUD or listing-ownership enforcement.

## 5. Listing Read and Search Architecture — Implemented

Application-table reads use Drizzle through src/db/queries/listings.ts and the read-only evergreen_runtime PostgreSQL role configured through DRIZZLE_DATABASE_URL. That login inherits shared SELECT permissions from evergreen_read. RLS is enabled and the runtime role cannot bypass RLS.

The shared-read policy contract is:

- listings: evergreen_read can SELECT all listing rows.
- reviews: evergreen_read can SELECT review rows.
- seller_profiles: evergreen_read can SELECT published profiles only (is_published = true).
- users: the shared SELECT policy permits visible rows, but SQL column grants expose only id and name; email is not accessible through the shared permissions.

Implemented listing Route Handlers:

| Method and path | Status | Behavior |
|---|---|---|
| GET /api/v1/listings | Implemented | Optional price, query, and tag filters |
| GET /api/v1/listings/[id] | Implemented | Returns a listing or the existing 404 response |

The existing GET-by-ID 404 behavior has been tested locally. Preserve it unless a demonstrated requirement calls for a change.

The handler files are src/app/api/v1/listings/route.ts (collection) and src/app/api/v1/listings/[id]/route.ts (item). These route.ts files are HTTP endpoints. Exporting another HTTP-method function from a route file adds that method to the same URL; a separate API server is not required.

```
Listing page / API
      ↓
src/db/queries/listings.ts
      ↓
Drizzle + postgres.js
      ↓  DRIZZLE_DATABASE_URL / evergreen_runtime
      ↓  shared grants + policies via evergreen_read
Supabase PostgreSQL (grants + RLS)
```

Filtering remains URL-driven: controls update search parameters, navigation renders server-side results, and Drizzle executes parameterized PostgreSQL queries. Server Components should call the query/data layer directly rather than making HTTP requests to this app's own public Route Handlers.

## 6. REST Mutation Architecture — Implemented in Source; Sign-off Pending

The dedicated `evergreen_app` connection and writer client exist, and migrations 0012–0016 define owner-aware policies and limited privileges. The source implements listing, seller-profile, review, and listing-media mutation endpoints. Presence of the migration files in Git is not proof that the live development database has applied them.

### REST endpoint inventory

| Method and path | Source status | Notes |
|---|---|---|
| GET /api/v1/listings | Implemented | Public listing collection with filters |
| POST /api/v1/listings | Implemented | Authenticated seller; profile required; owner from session |
| GET /api/v1/listings/[id] | Implemented | Preserve existing 404 behavior |
| PATCH /api/v1/listings/[id] | Implemented | Owner-filtered update; supported-field allowlist |
| DELETE /api/v1/listings/[id] | Implemented | Owner-filtered deletion and registered-media cleanup |
| POST /api/v1/seller-profiles | Implemented | Onboards the authenticated canonical user |
| GET/PATCH/DELETE /api/v1/seller-profiles | Implemented | Current user only; deletion denied while listings exist |
| GET/POST /api/v1/listings/[id]/reviews | Implemented | Public reads; authenticated review creation; unique listing/user pair |
| PATCH/DELETE /api/v1/listings/[id]/reviews/[reviewId] | **Needs route fix** | Handler expects `params.reviewId`, but the directory is currently named `[id]` |
| POST /api/v1/listings/[id]/media/upload-url | Implemented | Auth + ownership check before signed upload capability |
| POST /api/v1/listings/[id]/media/complete | Implemented | Validates ownership, path, object metadata, size and type before registering filename |
| DELETE /api/v1/listings/[id]/media/[filename] | Implemented | Owner check, registered filename check, private Storage removal |

The review-item source currently lives at `src/app/api/v1/listings/[id]/reviews/[id]/route.ts`, while its context type and handler destructuring expect both `id` and `reviewId`. Rename the inner directory to `[reviewId]`; the outward URL format remains the same. Until that is fixed and subsequently verified, review PATCH/DELETE must not be reported as fully working.

### Mutation request flow

```
HTTP request to a Next.js Route Handler
      ↓
Verify Better Auth session from request headers
      ↓
Validate body, resource ID, and allowed fields
      ↓
Dedicated app-write Drizzle transaction
      ↓
Set transaction-local app.current_user_id from verified session UUID
      ↓
Limited grants + owner-aware RLS and database invariants
      ↓
Commit/rollback and return a client-safe response
```

Write handlers must derive ownership from the verified session, never from client-supplied IDs. Use `APP_DATABASE_URL` for app mutations; never use `DIRECT_URL`, `evergreen_runtime`, or `evergreen_auth` for listing/profile/review writes. Server Components call query/data functions directly rather than making HTTP requests to their own Route Handlers.

The intended response contract is `{ data: ... }` for successful JSON responses and `{ error: { code, message } }` for errors. Current response bodies are not fully consistent across all implemented handlers; normalize or document this as part of API sign-off.

### Authorization and database requirements

- New listing creation requires a seller profile and derives `seller_user_id` from the verified session.
- Listing and profile mutations are owner-filtered and protected by RLS. Keep existing unowned listings immutable to ordinary users.
- Public shared reads expose only published seller profiles; the writer role can access the current user's own unpublished profile.
- The three-listings-per-seller cap is implemented as a database trigger using an advisory transaction lock; it must remain the final authority under concurrent attempts.
- Migration 0016 gives review INSERT permission only on `listing_id`, `user_id`, `rating`, and `comment`. The fixtures also carry stable review IDs and timestamps. If population persists these fixture values through the application writer, add a new forward migration granting only the necessary INSERT columns `id`, `created_at`, and `updated_at`; otherwise intentionally redesign the fixture contract to rely on database defaults.
- Automated endpoint/security tests have not yet been added. Bryan intends to run the expanded test phase after the planned Vite+ migration. Do not treat the passing fixture/read-permission baseline as proof of CRUD authorization.

## 7. Historical Data, Seed Fixtures, and Population

Historical records and intended mock fixtures have different purposes and must remain separate.

### Historical archive and current database state

- `seed/snapshots/existing-mock-data.json` is the immutable archive of the former database state. It preserves the six original listing records, their prior fields, three old reviews, three legacy reviewer identities, and the historical Storage-object inventory. Do not rewrite it to match the new schema or treat it as the intended seed dataset.
- The old mock database rows were cleared before migration 0009 was applied. The last verified state recorded in `agent-files/Agents_Context.md` had 0 listings, 0 reviews, 0 seller profiles, and 1 separate Evergreen Test user with 1 Better Auth account and 1 session. That test identity is not an intended fixture account.
- The private `property-images` bucket last had 15 objects totalling 39,998,905 bytes: 14 objects in the six listing-specific folders and one root object, `home-image.jpg`. All 15 source objects were reported downloaded and verified in the repository under `seed/images/`. These are recorded last-verified facts; recheck live DB/Storage state before any write or destructive Storage operation.

### Intended fixture dataset — implemented definitions and validation

- `src/db/seed/data.ts` defines fixture data; it does not connect to or modify the database and does not provision authentication accounts.
- `tests/data.test.ts` validates the fixture data and referenced local listing media.
- The intended dataset currently contains four synthetic sellers/profiles, 12 listings, and 48 reviews. Each seller owns exactly three listings, and every seller reviews every listing, including their own; self-reviews are intentional for mock data.
- The first six listings preserve their historical IDs, core details, and media filenames. Six additional listings have stable fixture IDs and currently empty media arrays.
- Review authors use stable seller keys, which the population operation must resolve to the canonical Better Auth user UUIDs.
- The old reviewer identities/reviews remain in the archive and are not duplicated in the new fixture dataset.
- Fixture data contains no passwords, password hashes, sessions, database URLs, or secrets. Do not add them.

The last reported checks after fixture changes were `npx tsc --noEmit`, `npx vitest run tests/data.test.ts`, and `npm run test:run`; the fixture suite passed 9 tests and the full suite passed 11 tests across 2 files. These are historical, user-reported results, not a claim that the commands were rerun during this documentation update.

### Planned population entry point

Implement `scripts/populate.ts` as a developer-run operation; it is not yet present. The expected workflow is:

- Provision only missing synthetic seller accounts through Better Auth's supported server-side email signup API; do not insert directly into `users`, `account`, or `session`, and do not commit a reusable seed password.
- Resolve the canonical user UUIDs, then create/reconcile profiles, listings and reviews through the dedicated writer client and per-user `withAppUserTransaction` calls. The RLS context must match each profile/listing owner and each review author.
- Preserve stable fixture listing/review identifiers and timestamps where defined. Migration 0016's current review INSERT grant does not yet permit fixture review `id`, `created_at`, or `updated_at`; add a new, narrow forward migration if preserving those fields.
- Preflight every fixture and local media path before writing. Upload only fixture-linked files to the private `property-images` bucket at `listings/<listing-id>/<filename>`; skip or reconcile already-present expected paths without overwriting unrelated objects. Do not include the separate root `home-image.jpg` as listing media.
- Be repeatable after partial failure, report inserts/updates/skips/failures, include non-writing dry-run and explicit write opt-in, refuse production/preview targets, and avoid deleting unrelated records or files.
- Never run from application startup or a public Route Handler.

## 8. Schema Changes and Ownership Readiness

The seed snapshot, fixture data, and current schema now exist in the repository. Further schema cleanup is still dependency-driven and must be evaluated against application code, UI types, fixtures, tests, and migrations before changing the database.

In particular:

- Do not reintroduce removed `users.auth_user_id`, `listings.seller`, `listings.stars`, or `seller_profiles.slug` columns just because they appear in historical migrations/snapshots.
- Keep `listings.seller_user_id` nullable until every retained listing has an owner. Make it non-null only after ownership is populated and verified, with a reviewed migration.
- Decide and implement the rating aggregate queries needed by listing cards/search results as well as detail pages.
- Generate and inspect new migrations; never edit already-applied historical migrations to represent the current schema.

## 9. Supabase Storage and Media Model

The listing `media` array stores filenames, not public URLs. Runtime media uses `src/db/supabase/util/GetMediaUrls.ts`, which reads filenames under `listings/<listing-id>/<filename>`, preserves the order of filenames already in the array, appends Storage files not listed in the array, and generates signed URLs. The bucket remains private; do not replace this with public local media paths.

There are exactly two media categories:

```ts
type ListingMedia = {
  type: "image" | "video";
  src: string;
  alt?: string;
};
```

JPG/JPEG/PNG/WebP/AVIF/GIF map to `image`; MP4/WebM map to `video`. GIF is not a third category. Classification removes query strings/fragments because signed URLs contain query parameters. Images use Next.js `<Image>`; videos use native `<video controls>`. `ListingMediaCarousel` uses Embla as a Client Component.

Signed URLs expire. Server-rendered pages relying on newly signed URLs must not be indefinitely cached; the home page currently uses `dynamic = "force-dynamic"`.

The repository uses `src/lib/netlifyImageLoader.ts` for production image optimization through Netlify Image CDN. In local development, `next.config.ts` sets `images.unoptimized` to `true`, so local development uses original signed source URLs instead of requesting Netlify's production-only `/.netlify/images` endpoint. `netlify.toml` allowlists the Supabase remote image host. Preserve this environment-aware behavior.

## 10. Environment and Secret Boundaries

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DIRECT_URL=             # privileged migration connection only
DRIZZLE_DATABASE_URL=   # read-only evergreen_runtime
AUTH_DATABASE_URL=      # Better Auth / evergreen_auth
APP_DATABASE_URL=       # app writer / evergreen_app
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
SUPABASE_SECRET_KEY=    # server-only private Storage administration
```

For Supabase shared transaction-pooler connections, use the Dashboard's copied host/port and role username format `<role>.<project-ref>`; disable postgres.js prepared statements as configured in the database clients. Keep app writer, auth, runtime read-only, and privileged migration connections separate. Never expose credentials or `BETTER_AUTH_SECRET` in client bundles or committed fixtures.

## 11. Verification and Work Order

Bryan reports that the current local baseline commands passed. The repository's tests presently cover fixture integrity and read-only runtime permissions, not the API authorization paths or application-writer permissions. The expanded automated security test phase is intentionally deferred until after Bryan's planned Vite+ migration.

### Work before the final test phase

1. Rename the inner review-item route directory from `[id]` to `[reviewId]` so PATCH/DELETE receive distinct route parameters.
2. Reconcile the migration-0016 review/profile-delete policies with `src/db/schema.ts` and Drizzle's snapshot without rewriting applied SQL.
3. Add a forward migration for the narrow review INSERT columns needed to persist fixture IDs and timestamps, unless the fixture contract is explicitly revised to use database defaults.
4. Add `APP_DATABASE_URL` to `.env.example` and keep README setup instructions in sync.
5. Implement `scripts/populate.ts` as a developer-run operation: validate all fixtures/assets; provision missing seed accounts via Better Auth's supported server-side signup API; resolve UUIDs; create/reconcile profiles, listings and reviews with per-owner transactions; upload only fixture-linked files to private Storage; and report inserts, updates, skips and failures.
6. Include a non-writing dry-run plus explicit write opt-in. Refuse production/preview targets, preflight required credentials/migrations/roles/assets, never delete unrelated rows/files, and never run at app startup or through an HTTP route.
7. The first six fixtures reference 14 existing source media files; the six newer fixtures currently have empty media arrays. Decide whether to add six further property-media assets as part of this milestone.

### Final test phase after the planned Vite+ migration

- Add and run Route Handler tests for request validation, status/error response contracts, unauthenticated writes, unsupported/forged ownership fields, and missing/non-owned resources.
- Add database checks for app-role grants, owner-aware RLS, unpublished profile isolation, review CRUD, media registration/deletion, and the concurrency-safe three-listing cap.
- Exercise population in dry-run and against an isolated non-production DB/Storage target; run it twice to prove idempotency and check partial-failure recovery.
- Run final type-check, tests, production build, Drizzle checks, and verify the live migration state before considering CRUD/security signed off.

Do not describe CRUD as security-signed-off until the final phase passes. The current test runner is Vitest; the planned final test phase depends on Bryan's intended Vite+ migration. Consult installed Next.js 16 documentation under `node_modules/next/dist/docs/` before framework-sensitive changes.

## 12. Architecture Overview

```
Next.js App Router
  ├─ Server Components/pages
  │   └─ Drizzle read/query layer
  │       └─ DRIZZLE_DATABASE_URL / evergreen_runtime
  │           └─ inherited evergreen_read permissions + RLS
  ├─ Route Handlers
  │   ├─ /api/auth/[...all] → Better Auth
  │   │   └─ AUTH_DATABASE_URL / evergreen_auth
  │   ├─ /api/v1/listings → GET / POST
  │   ├─ /api/v1/listings/[id] → GET / PATCH / DELETE
  │   ├─ /api/v1/seller-profiles → POST / GET / PATCH / DELETE
  │   ├─ /api/v1/listings/[id]/reviews → GET / POST
  │   └─ review-item PATCH / DELETE → rename inner segment to [reviewId]
  ├─ APP_DATABASE_URL / evergreen_app
  │   └─ owner-scoped transactions + RLS + limited writes
  └─ Supabase JS Storage helper
      └─ private property-images bucket
          ├─ runtime: signed URLs + authenticated media routes
          └─ scripts/populate.ts: planned developer-only fixture upload

DIRECT_URL → Drizzle Kit migrations only
```
