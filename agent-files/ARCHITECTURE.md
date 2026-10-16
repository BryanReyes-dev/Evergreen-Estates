# Evergreen Estates Architecture

## Document Authority

This is the single authoritative record of finalized Evergreen Estates architectural decisions. Approved target designs that are not implemented are explicitly labeled as such.

- `agent-files/Agents_Context.md` is current working context and task status.
- `agent-files/AGENTS.md` contains agent operating rules.
- `agent-files/CLAUDE.md` is the Claude entry point.
- Never describe planned code as already implemented.

## 1. Project Identity and Stack

Evergreen Estates is a real-estate marketplace built with Next.js 16.x App Router, React, TypeScript, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

Implemented: property browsing, listing details, URL-based search/filtering, review display, listing media, and Better Auth email/password authentication. Listing API endpoints currently support GET only; authenticated listing writes are pending.

## 2. Application Structure

```
src/
├── app/          pages, layouts, Route Handlers, server/client boundaries
├── components/   reusable UI and feature components
├── db/           Drizzle schemas/queries/clients and Supabase Storage helpers
└── lib/          shared utilities and Better Auth configuration

agent-files/      agent guidance, current context, architecture authority
drizzle/          SQL migrations and Drizzle Kit metadata
scripts/          planned developer-run population entry point
seed/             planned bundled mock media assets
```

`src/db` is the database boundary. Keep application-table query logic here rather than duplicating it in presentation components.

## 3. Server, Client, and HTTP Boundaries

Server Components are the default for data fetching and rendering. Client Components are for browser-only behavior such as event handlers, interactive state, animation, client navigation, and Embla interaction.

Explicit HTTP APIs live in Next.js Route Handlers under `src/app/api`. CRUD requests must verify the Better Auth session on the server, validate input, enforce business rules, and call narrowly scoped database operations. Client-side checks are not authorization.

## 4. Listing Read and Search Architecture

Application table reads use Drizzle via `src/db/queries/listings.ts` and the dedicated read-only `evergreen_runtime` PostgreSQL login configured through `DRIZZLE_DATABASE_URL`. This role has read-only grants and matching RLS policies and cannot bypass RLS.

Supabase JS under `src/db/supabase` is used for Storage operations only. Drizzle Kit migrations use the privileged `DIRECT_URL` connection only.

Implemented listing APIs:
- `GET /api/v1/listings` supports optional price, query, and tag filters.
- `GET /api/v1/listings/[id]` returns a listing or the existing 404 response. Its current missing-listing behavior has been tested locally and should not be changed without a concrete reason.

```
Listing page / API
      ↓
src/db/queries/listings.ts
      ↓
Drizzle + postgres.js
      ↓  DRIZZLE_DATABASE_URL / evergreen_runtime (read-only)
Supabase PostgreSQL (grants + RLS)
```

Property filtering is URL-driven: filter controls update search parameters, navigation renders server-side results, and Drizzle executes parameterized PostgreSQL queries.

## 5. Authentication Architecture — Implemented

Better Auth email/password authentication is integrated.

- `src/lib/auth.ts` lazily constructs Better Auth.
- `src/db/drizzle/auth-client.ts` provides the auth-only Drizzle connection.
- `src/db/auth-schema.ts` defines `account`, `session`, and `verification`.
- `src/app/api/auth/[...all]/route.ts` delegates GET/POST to Better Auth's Next.js handler.
- `src/lib/auth-client.ts` exposes the same-origin browser auth client.
- Better Auth's logical `user` model maps directly to the existing canonical `public.users` table. There is not a separate Better Auth user table.
- Better Auth IDs are UUIDs.
- `AUTH_DATABASE_URL` uses the restricted `evergreen_auth` PostgreSQL login. It has access to the canonical users table and auth tables, not general listing-write permissions.

Email/password registration, sign-in, session retrieval, and sign-out were manually tested locally. These checks validate the basic auth flow, not CRUD or listing ownership enforcement.

`users.auth_user_id` is a legacy/transitional column, not the Better Auth identity mapping. Do not remove it until the seed-data move and repository-wide dependency audit are complete.

## 6. Target Listing Write Architecture — Approved, Not Implemented

Keep the read and authentication roles unchanged. The target write connection is `APP_DATABASE_URL` using a least-privilege `evergreen_app` login. Neither the writer role/client nor ownership-aware listing-write policies exist yet. Never grant listing writes to `evergreen_runtime` or `evergreen_auth`, and never use `DIRECT_URL` in a request handler.

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

The proposed database owner predicates use a transaction-local setting such as `set_config('app.current_user_id', ..., true)`. The server must set this only from the verified Better Auth session; never trust a user ID supplied by the browser. Transaction-local scope prevents user identity leaking across pooled connections. This server-side setting is defense in depth, not a replacement for protecting the writer credential.

Rules for CRUD:
- Seller-profile onboarding must associate a profile with the authenticated canonical user ID.
- A user can modify only their own listings.
- New listings require an owner; owner identity must not be client-selectable.
- Limit each seller to three active listings. Enforce it server-side with concurrency-safe handling; a plain count-then-insert can race.
- Existing listings currently have `seller_user_id = NULL`. They must not become mutable to ordinary signed-in users until their owners have been deliberately assigned.
- Rate-limit registration and repeated creates as additional abuse controls, separate from ownership and listing-cap enforcement.

Test anonymous requests, invalid input, cross-user changes/deletes, ownership reassignment, concurrent creates, and the three-listing cap.

## 7. Portable Mock Data and Population — Principles Approved; Details Deferred

Intentional mock records should become editable repository fixtures so a fresh environment can recreate the app data. Do not finalize or implement the population script before CRUD and ownership are stable.

Use a minimal two-code-file design:

```
src/db/seed/data.ts   # exports editable seed definitions
scripts/populate.ts   # exports/calls populate() and imports data.ts
seed/images/          # bundled source media files
```

Avoid creating a redundant `src/db/seed/populate.ts`. `data.ts` defines what should exist; `scripts/populate.ts` defines how to populate the database and Storage.

The current Supabase database contains six intended mock listings. The Modern Luxury Villa has three existing reviews referencing mock public-user rows named Alex Johnson, Sarah Williams, and Michael Brown. These three user rows did not have Better Auth credential accounts. A separate Evergreen Test user has an account/session from auth testing; do not treat that test user as intended seed data.

Preserve meaningful listing fields and stable existing listing IDs where practical because the IDs are part of the Storage paths. Review fixtures should reference stable seed keys or emails and resolve the Better Auth-generated user IDs during population rather than relying on generated IDs being identical across databases.

A reasonable initial data set is four synthetic sellers, the six existing listings plus six new listings (12 total), and up to three seeded listings per seller. This is a starting target, not a hard limit on future fixture customizations.

### Preserve Supabase Storage

The existing `property-images` bucket is private. Runtime media uses `src/db/supabase/util/GetMediaUrls.ts`, which reads filenames under `listings/<listing-id>/<filename>` and returns signed URLs. Do not replace this with public local paths.

Bundle source assets under:

```
seed/images/listings/<listing-id>/<filename>
```

The future populate script should upload files into the same relative paths inside the private `property-images` bucket. Media names in fixture data must match Storage object names. Existing bucket content currently includes 14 listing media files across the six listing folders (JPEGs, a GIF, and an MP4).

The eventual `populate()` should use a supported server-side Better Auth workflow for valid seed accounts, create profiles/listings/reviews and resolve foreign keys, upload source media, safely repeat without duplicating seed-managed records, report its result, avoid deleting unrelated data by default, and require explicit safeguards against accidentally targeting production. Do not commit reusable passwords, hashes, DB URLs, or secrets. Never run population from app startup or a public route.

No complete fixture export has been committed yet. Keep the live data intact until the copy is complete and verified.

## 8. Schema Cleanup Depends on the Portable Dataset

Only after mock data is preserved in the repository and code/UI relationships are migrated should we remove temporary or legacy schema. Audit every field in application code, tests, Drizzle schema, migration history, UI types, and fixtures before changing the database.

Candidate fields to review (not automatic deletion instructions):
- `users.auth_user_id` — transitional; Better Auth maps directly to `users`.
- `listings.seller` — denormalized legacy display text currently returned to the UI.
- `listings.seller_user_id` — nullable to support current unowned records; should become required only after all retained listings have a valid owner.
- Any other columns shown by dependency and data audits to exist only for the old mock-data arrangement.

Generate and inspect a migration, preserve real product requirements, and verify data/UI behavior before dropping any field.

## 9. Supabase Storage and Media Model

The listing `media` array stores filenames, not public URLs. `GetMediaUrls.ts` discovers files under `listings/<listing-id>`, preserves the order of filenames already in the array, appends Storage files not in the array, and generates signed URLs. The bucket remains private.

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

## 10. Image Optimization

`src/lib/netlifyImageLoader.ts` generates Netlify Image CDN URLs in production. The Supabase remote host is allowlisted in `netlify.toml`.

In local development, `next.config.ts` sets `images.unoptimized` to `true` when `NODE_ENV` is `development`. Local development uses original signed source URLs instead of requesting Netlify's production-only `/.netlify/images` endpoint. Preserve this environment-aware behavior.

## 11. Environment and Secret Boundaries

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DIRECT_URL=             # migration/admin connection only
DRIZZLE_DATABASE_URL=   # read-only evergreen_runtime
AUTH_DATABASE_URL=      # Better Auth / evergreen_auth
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
APP_DATABASE_URL=       # planned; not used until writer is implemented
```

`APP_DATABASE_URL` is an approved future name, not a functioning connection/client yet. Keep DB URLs and the Better Auth secret server-only. For Supabase shared transaction pooler connections, use the Dashboard's copied host/port and the role username format `<role>.<project-ref>`; postgres.js may require prepared statements disabled. Never expose write credentials or `BETTER_AUTH_SECRET` through a `NEXT_PUBLIC_` variable.

## 12. Verification and Work Order

The last user-reported local checks after authentication setup passed: `npx tsc --noEmit`, `npm run build`, `npx drizzle-kit check`, `npm run test:run`, and `npx drizzle-kit migrate`. These historic results do not verify future CRUD, schema cleanup, or seeding work; rerun relevant checks after changes.

Current sequence:
1. Export all six existing listings, reviews, referenced mock identities, and required field values into version-controlled fixtures; download and inventory all 14 existing listing Storage assets. Verify completeness before cleanup.
2. Implement app-write connection/role, ownership RLS, seller onboarding, authenticated listing POST/PATCH/DELETE, and the three-listing cap. Test security boundaries.
3. Audit/replace schema dependencies and remove temporary legacy fields only after fixtures and CRUD/UI code are ready.
4. Finalize and implement `populate()` against the stable schema/CRUD model, including private-bucket uploads, idempotency, safety checks, and fresh-database verification.
5. Connect CRUD to the UI and test the end-to-end experience.

Consult the installed Next.js 16 documentation before framework-sensitive changes.

## 13. Architecture Overview

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
