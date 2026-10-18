# Evergreen Estates Architecture

## Document Authority

This is the authoritative record of finalized Evergreen Estates architecture. Proposed designs that are not implemented must be labeled as planned.

- `agent-files/Agents_Context.md` records current implementation status, verified findings, and the immediate work order.
- `agent-files/AGENTS.md` contains operating rules for coding agents.
- `agent-files/CLAUDE.md` includes the agent rules, context, and this architecture file.
- Never describe planned code as implemented. Replace stale instructions instead of adding contradictory history.

## 1. Project Identity and Stack

Evergreen Estates is a real-estate marketplace built with Next.js 16.x App Router, React, TypeScript, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

Implemented functionality includes public property browsing, listing details, URL-driven search/filtering, listing media and review display, and Better Auth email/password authentication. The listing API currently supports GET only; listing mutations and seller onboarding are not implemented.

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
| `APP_DATABASE_URL` | `evergreen_app` | Least-privilege application writes | Planned; not implemented |

Never use `DIRECT_URL` in a request handler. Do not grant general listing writes to `evergreen_runtime` or `evergreen_auth`. All database URLs and Better Auth secrets must remain server-only; never expose them through `NEXT_PUBLIC_` variables.

Supabase JS under `src/db/supabase` is used for Storage operations, not application-table queries. Application-table reads use Drizzle and PostgreSQL. The database clients use lazy initialization and disable postgres.js prepared statements for compatibility with the Supabase shared transaction pooler.

## 4. Current Schema

The schema source is `src/db/schema.ts`, with Better Auth tables defined in `src/db/auth-schema.ts`. Migration history is versioned under `drizzle/`. Do not rewrite historical migrations to make them resemble the current schema.

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

Application-table reads use Drizzle through `src/db/queries/listings.ts` and the read-only `evergreen_runtime` PostgreSQL role configured through `DRIZZLE_DATABASE_URL`. That role has read-only grants and matching RLS policies and cannot bypass RLS.

Implemented listing endpoints:

- `GET /api/v1/listings` supports optional price, query, and tag filters.
- `GET /api/v1/listings/[id]` returns a listing or the existing 404 response.

The missing-listing 404 behavior has been tested locally. Do not change it without a concrete reason.

```
Listing page / API
      ↓
src/db/queries/listings.ts
      ↓
Drizzle + postgres.js
      ↓  DRIZZLE_DATABASE_URL / evergreen_runtime (read-only)
Supabase PostgreSQL (grants + RLS)
```

Filtering is URL-driven: controls update search parameters, navigation renders server-side results, and Drizzle executes parameterized PostgreSQL queries.

## 6. Target Listing Write Architecture — Approved, Not Implemented

The planned writer is `APP_DATABASE_URL` using a least-privilege `evergreen_app` login. The writer role/client, owner-aware listing-write policies, seller-onboarding endpoint, and listing mutations do not exist yet. Keep the read and authentication roles unchanged.

Target request flow:

```
POST/PATCH/DELETE Route Handler
      ↓
Verify Better Auth session from request headers
      ↓
Validate and normalize the body
      ↓
App-write database transaction
      ↓
Set transaction-local app.current_user_id from verified session UUID
      ↓
Owner-aware RLS + limited table grants
      ↓
Commit or rollback
```

The proposed owner predicates use a transaction-local setting such as `set_config('app.current_user_id', ..., true)`. The server must set it only from the verified Better Auth session; never trust a user ID supplied by the browser. Transaction-local scope prevents identity from leaking across pooled connections. This is defense in depth, not a replacement for protecting the writer credential.

CRUD/security requirements:

- Seller onboarding must associate a profile with the authenticated canonical `users.id`.
- Only the owner may update or delete a listing.
- A new listing requires an eligible seller profile; owner identity is not client-selectable.
- Limit each seller to three active listings. Enforce the cap with concurrency-safe handling; a plain count-then-insert can race.
- Listing writes must not make unowned existing rows mutable to ordinary signed-in users.
- Test anonymous requests, invalid input, cross-user changes/deletes, ownership reassignment, concurrent creates, and the listing cap.
- Rate-limit registration/repeated creates as additional abuse controls, separate from ownership and cap enforcement.

Do not enable mutation handlers until their authorization boundaries are implemented and tested.

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
DIRECT_URL=             # privileged migration/admin connection only
DRIZZLE_DATABASE_URL=   # read-only evergreen_runtime
AUTH_DATABASE_URL=      # Better Auth / evergreen_auth
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
APP_DATABASE_URL=       # planned; do not configure/use until writer is implemented
```

For Supabase shared transaction-pooler connections, use the Dashboard's copied host/port and role username format `<role>.<project-ref>`; postgres.js may require prepared statements disabled. Never expose database credentials or `BETTER_AUTH_SECRET` in client bundles or committed fixtures.

## 11. Verification and Work Order

Historical checks after authentication setup included `npx tsc --noEmit`, `npm run build`, `npx drizzle-kit check`, `npm run test:run`, and `npx drizzle-kit migrate`. Fixture-specific checks were later reported passing as described above. Re-run relevant checks after code changes; do not treat historical outcomes as verification of future CRUD, seeding, or schema changes.

Current order:

1. Implement the dedicated least-privilege writer connection/role and owner-aware RLS policies without changing the runtime/auth/migration connection boundaries.
2. Implement seller-profile onboarding and authenticated listing POST/PATCH/DELETE operations; verify owner-only access and concurrency-safe three-listing enforcement.
3. Audit and finalize ownership/rating schema constraints once their data dependencies are known.
4. Implement and test the safe, idempotent population operation, including Better Auth account provisioning and private Storage uploads.
5. Connect CRUD to the UI and verify the end-to-end experience with type-checks, tests, migration checks, and a production build.

Consult the installed Next.js 16 documentation under `node_modules/next/dist/docs/` before framework-sensitive changes.

## 12. Architecture Overview

```
Next.js App Router
  ├─ Server Components/pages
  │   └─ Drizzle read client
  │       └─ DRIZZLE_DATABASE_URL / evergreen_runtime (read-only)
  ├─ Route Handlers
  │   ├─ /api/auth/[...all] → Better Auth
  │   │   └─ AUTH_DATABASE_URL / evergreen_auth
  │   └─ /api/v1/listings (GET implemented; writes pending)
  │       └─ future authenticated writer
  │           └─ APP_DATABASE_URL / evergreen_app (planned)
  └─ Supabase JS Storage helper
      └─ private property-images bucket
          ├─ runtime: signed URLs
          └─ future populate script: upload seed/images assets

DIRECT_URL → Drizzle Kit migrations only
```
