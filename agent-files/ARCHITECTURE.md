# Evergreen Estates Architecture

## Document Authority

This is the authoritative record of finalized Evergreen Estates architecture. Proposed designs that are not implemented must be labeled as planned.

- `agent-files/Agents_Context.md` records current implementation status, verified findings, and the immediate work order.
- `agent-files/AGENTS.md` contains operating rules for coding agents.
- `agent-files/CLAUDE.md` includes the agent rules, context, and this architecture file.
- Never describe planned code as implemented. Replace stale instructions instead of adding contradictory history.

## 1. Project Identity and Stack

Evergreen Estates is a real-estate marketplace built with Next.js 16.x App Router, React, TypeScript, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

Implemented functionality includes public property browsing, listing details, URL-driven search/filtering, listing media and review display, Better Auth email/password authentication, seller-profile CRUD, listing creation, and review CRUD. Listing update/delete handlers, media upload completion integration, UI mutation flows, and the database population operation are not established as complete in this checkout. Treat working-tree changes as local, uncommitted implementation until independently validated and committed.

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

The application uses separate database credentials for distinct responsibilities:

| Environment variable | Database role | Purpose | State |
|---|---|---|---|
| `DRIZZLE_DATABASE_URL` | `evergreen_runtime` | Read-only application-table queries | Implemented |
| `AUTH_DATABASE_URL` | `evergreen_auth` | Better Auth user, account, session, and verification operations | Implemented |
| `DIRECT_URL` | Privileged migration connection | Drizzle Kit migrations only | Implemented |
| `APP_DATABASE_URL` | `evergreen_app` | Least-privilege application writes | Client, grants, and owner-scoped policies exist in the current checkout; deployed role configuration is not verified here |

The NOLOGIN role evergreen_read holds common SELECT privileges and is the target for shared-read RLS policies. Migration 0011 grants membership to evergreen_runtime and evergreen_app with INHERIT TRUE, SET FALSE. The runtime role remains read-only. The current checkout adds an app client and narrowly scoped table grants/policies in later migrations. The app client sets `app.current_user_id` transaction-locally from the verified Better Auth session before writes. These repository files do not prove the migrations have been applied to a live database.

Migration 0010 creates evergreen_app with CONNECT only. Applied migration 0011 creates evergreen_read, grants common reads (only users.id and users.name in public.users), switches the read-policy targets, and removes runtime's duplicate direct read grants. Drizzle schema source controls role and policy declarations; 0011 also contains explicit GRANT/REVOKE and membership SQL that Drizzle Kit does not generate from the TypeScript schema.

Never use DIRECT_URL in a request handler. Do not grant general listing writes to evergreen_runtime or evergreen_auth. All database URLs and Better Auth secrets must remain server-only; never expose them through NEXT_PUBLIC_ variables.
Supabase JS under `src/db/supabase` is used for Storage operations, not application-table queries. Application-table reads use Drizzle and PostgreSQL. The database clients use lazy initialization and disable postgres.js prepared statements for compatibility with the Supabase shared transaction pooler.

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

## 6. Application Write Architecture — Partially Implemented

The evergreen_app login originates in migration 0010 and was added to evergreen_read in migration 0011. The current working tree includes APP_DATABASE_URL support, a dedicated app Drizzle client, owner-aware write policies, constrained grants, and migrations 0013–0018. The current branch also contains authenticated seller-profile CRUD, listing creation, and review CRUD. These are local implementation changes; no build, test, migration-application, or live permission verification was performed as part of this documentation audit.

### REST endpoint plan

Use Next.js App Router Route Handlers as the explicit HTTP API contract:

| Method and path | Status | Responsibility |
|---|---|---|
| GET /api/v1/listings | Implemented | List/search/filter public listings |
| POST /api/v1/listings | Present locally | Create a listing for the current authenticated seller; enforce the three-listing cap in the database |
| GET /api/v1/listings/[id] | Implemented | Read one listing; preserve existing 404 behavior |
| PATCH /api/v1/listings/[id] | Not present | Planned partial update for an owned listing |
| DELETE /api/v1/listings/[id] | Not present | Planned deletion for an owned listing |
| GET/POST/PATCH/DELETE /api/v1/seller-profiles | Present locally | Read/create/update/delete the authenticated user's profile |
| POST /api/v1/listings/[id]/reviews | Present locally | Create the authenticated user's review |
| PATCH/DELETE /api/v1/listings/[id]/reviews/[reviewId] | Present locally | Update/delete the authenticated user's review |

Collection methods belong in src/app/api/v1/listings/route.ts; item methods belong in src/app/api/v1/listings/[id]/route.ts. Review item routing uses the distinct `[reviewId]` parameter. Add listing PATCH/DELETE only after the current local handlers and policies have been reviewed and tested. PATCH is chosen for partial updates; add PUT only if full-resource replacement is deliberately designed.

### Target write request flow

```
HTTP request to a Next.js Route Handler
      ↓
Verify Better Auth session from request headers
      ↓
Validate body and allowlisted mutable fields
      ↓
Dedicated app-write Drizzle client / transaction
      ↓
Set transaction-local app.current_user_id from verified session UUID
      ↓
Limited grants + owner-aware RLS and database invariants
      ↓
Commit/rollback and return a client-safe JSON response
```

Write handlers must derive the owner from the verified Better Auth session, never a browser-supplied userId or seller_user_id. Keep route handlers focused on HTTP concerns (auth, validation, status/JSON response) and delegate SQL work to src/db mutation/query modules. Use only APP_DATABASE_URL for app writes; never use DIRECT_URL, evergreen_runtime, or evergreen_auth for listing writes.

Use the established JSON envelope: successful reads/updates return { data: ... }; errors return { error: { code, message } }. Keep status behavior consistent: 201 for created resources, 200 for successful reads/updates, 204 for deletes with no body, 400 for invalid input, 401 for missing/invalid sessions, 404 for missing or non-owned resources, 409 for business-rule conflicts, and 500 with a generic message for unexpected errors.

### Authorization and database requirements

- Seller onboarding creates seller_profiles.user_id from the canonical users.id associated with the verified session.
- A listing's seller_user_id is derived from the current session and an eligible seller profile; clients cannot choose or reassign ownership.
- Only the owner may update or delete a listing. Existing unowned rows must remain immutable to ordinary users.
- Shared reads of seller_profiles remain limited to published profiles. The current schema has app-specific owner policies for a seller's own profile, including unpublished profiles.
- Grant only the INSERT/UPDATE/DELETE and column privileges the handlers require. Keep users and Better Auth tables outside the app writer's write scope.
- Enforce the three-active-listings-per-seller cap with concurrency-safe database logic; a plain count-then-insert check can race.
- Test anonymous writes, invalid payloads, cross-user mutations, owner reassignment attempts, unpublished-profile access, concurrent creates, and listing-cap conflicts before enabling the UI.

The proposed owner policy can use a transaction-local setting such as set_config('app.current_user_id', sessionUserId, true). Set it only on the writer transaction using the verified session UUID. This is defense in depth, not protection against compromise of the writer credential or arbitrary SQL under that credential.

## 7. Historical Data, Seed Fixtures, and Population

Historical records and intended mock fixtures have different purposes and must remain separate.

### Historical archive and current database state

- `seed/snapshots/existing-mock-data.json` is the immutable archive of the former database state. It preserves the six original listing records, their prior fields, three old reviews, three legacy reviewer identities, and the historical Storage-object inventory. Do not rewrite it to match the new schema or treat it as the intended seed dataset.
- The old mock database rows were cleared before migration 0009 was applied. The last verified state recorded in `agent-files/Agents_Context.md` had 0 listings, 0 reviews, 0 seller profiles, and 1 separate Evergreen Test user with 1 Better Auth account and 1 session. That test identity is not an intended fixture account.
- The private `property-images` bucket last had 15 objects totalling 39,998,905 bytes: 14 objects in the six listing-specific folders and one root object, `home-image.jpg`. All 15 source objects were reported downloaded and verified in the repository under `seed/images/`. These are recorded last-verified facts; recheck the live service before any destructive Storage operation.

### Intended fixture dataset — implemented definitions and validation

- `src/db/seed/data.ts` defines editable fixture data; it does not connect to or modify the database and does not provision authentication accounts.
- `tests/data.test.ts` validates the fixture data and referenced local listing media.
- The intended dataset currently contains four synthetic sellers/profiles, 12 listings, and 48 reviews. Each seller owns exactly three listings, and every seller reviews every listing, including their own; self-reviews are intentional for this mock dataset.
- The first six listings preserve their historical IDs, core details, and media filenames. Six additional listings have stable fixture IDs and currently empty media arrays.
- Review authors use stable seller keys, which a future population operation must resolve to the actual Better Auth user UUIDs.
- The old reviewer identities/reviews remain in the archive and are not duplicated in the new fixture dataset.
- Fixture data contains no passwords, password hashes, sessions, database URLs, or secrets. Do not add them.

The last reported checks after fixture changes were `npx tsc --noEmit`, `npx vitest run tests/data.test.ts`, and `npm run test:run`; the fixture suite passed 9 tests and the full suite passed 11 tests across 2 files. These are historical, user-reported results, not a claim that code was rerun during this documentation change.

### Planned population entry point

Implement `scripts/populate.ts` only after CRUD, ownership enforcement, and relevant schema decisions are stable. Avoid a redundant `src/db/seed/populate.ts`; `data.ts` defines what should exist and `scripts/populate.ts` defines how to populate it.

The future population operation must:

- Provision the four login-capable seed accounts through a supported server-side Better Auth flow without committing reusable credentials.
- Resolve actual user UUIDs and create matching seller profiles.
- Insert or safely reconcile listings and reviews while resolving fixture keys/foreign keys.
- Upload bundled files to the private `property-images` bucket using `listings/<listing-id>/<filename>` paths; fixture media filenames must match object names.
- Be safe to repeat without duplicating fixture-managed records and report inserts, updates, skips, and validation failures.
- Avoid deleting unrelated data by default, include explicit safeguards against targeting production, and never run at app startup or through a public route.
- Preserve the existing private-bucket and signed-URL design.

## 8. Schema Changes and Ownership Readiness

The seed snapshot, fixture data, and current schema now exist in the repository. Further schema cleanup is still dependency-driven and must be evaluated against application code, UI types, fixtures, tests, and migrations before changing the database.

In particular:

- Do not reintroduce removed `users.auth_user_id`, `listings.seller`, `listings.stars`, or `seller_profiles.slug` columns just because they appear in historical migrations/snapshots.
- Keep `listings.seller_user_id` nullable until every retained listing has an owner. Make it non-null only after ownership is populated and verified, with a reviewed migration.
- Decide and implement the rating aggregate queries needed by listing cards/search results as well as detail pages.
- Generate and inspect new migrations; never edit already-applied historical migrations to represent the current schema.

## 9. Supabase Storage and Media Model

The listing `media` array stores filenames, not public URLs. Runtime media uses `src/db/supabase/util/GetMediaUrls.ts` and the server-only Storage admin helper. It preserves the database filename order, filters out filenames that do not exist in Storage, and generates signed URLs. The bucket remains private; migration 0018 removes the prior public-read policy. The repository does not establish whether that migration has been applied to production.

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
DIRECT_URL=             # privileged migration/admin connection only
DRIZZLE_DATABASE_URL=   # read-only evergreen_runtime
AUTH_DATABASE_URL=      # Better Auth / evergreen_auth
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
APP_DATABASE_URL=       # server-only app writer using evergreen_app; present in current setup
SUPABASE_SECRET_KEY=    # server-only Storage admin credential
```

For Supabase shared transaction-pooler connections, use the Dashboard's copied host/port and role username format `<role>.<project-ref>`; postgres.js may require prepared statements disabled. Never expose database credentials or `BETTER_AUTH_SECRET` in client bundles or committed fixtures.

## 11. Verification and Work Order

Historical checks after authentication and fixture setup included npx tsc --noEmit, npm run build, npx drizzle-kit check, npm run test:run, and npx drizzle-kit migrate. The fixture suite was previously reported as passing 9 tests and the full suite 11 tests across 2 files. Those results do not verify future CRUD handlers, the app writer connection, or population.

Current follow-up work (audit snapshot, 2026-10-20):

1. Review the uncommitted app-write client, grants/policies, and handlers for correctness; no implementation completeness is assumed from file presence.
2. Verify route contracts and authorization behavior with appropriate tests and confirm required migrations/role settings against the intended database before relying on these mutations.
3. Keep listing update/delete, user-facing mutation flows, and population work explicitly planned until implemented and verified. Do not populate the live database during the documentation audit.

Next work session (Monday, 2026-10-19):

1. Expand/run Vitest coverage for CRUD validation, session requirements, owner isolation, role privileges/RLS, and three-listing concurrency behavior.
2. Implement scripts/populate.ts only after schema, writer grants, and CRUD ownership are stable. It must be repeatable, use fixtures from src/db/seed/data.ts, provision seller accounts through Better Auth, upload assets to private Storage, avoid deleting unrelated rows, guard against production, and never run from app startup or a public route.
3. Run full type-check/tests/build/migration checks and targeted authorization tests; then connect the UI to the proven endpoints.

Do not let work on Vite or unrelated tooling distract from this API/security milestone. The current test runner is Vitest (npm run test:run). Consult installed Next.js 16 documentation under node_modules/next/dist/docs/ before framework-sensitive changes.

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
  │   ├─ /api/v1/listings
  │   │   ├─ GET implemented
   │   │   └─ POST present locally
  │   └─ /api/v1/listings/[id]
  │       ├─ GET implemented
   │       ├─ PATCH planned
   │       └─ DELETE planned
   ├─ /api/v1/seller-profiles → GET/POST/PATCH/DELETE present locally
   └─ /api/v1/listings/[id]/reviews → POST; /[reviewId] → PATCH/DELETE present locally
  └─ Supabase JS Storage helper
      └─ private property-images bucket
          ├─ runtime: signed URLs
          └─ future populate script: upload seed/images assets

DIRECT_URL → Drizzle Kit migrations only
```

