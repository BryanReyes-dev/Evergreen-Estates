# Evergreen Estates Architecture

## Document Authority

This is the authoritative record of finalized Evergreen Estates architecture. Proposed designs that are not implemented must be labeled as planned.

- `agent-files/Agents_Context.md` records current implementation status, verified findings, and the immediate work order.
- `agent-files/AGENTS.md` contains operating rules for coding agents.
- `agent-files/CLAUDE.md` includes the agent rules, context, and this architecture file.
- Never describe planned code as implemented. Replace stale instructions instead of adding contradictory history.

## 1. Project Identity and Stack

Evergreen Estates is a real-estate marketplace built with Next.js 16.x App Router, React, TypeScript, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

Implemented source includes public property browsing, listing details, URL-driven search/filtering, Better Auth email/password auth, account settings for name/avatar/password and browsing preferences, seller-profile editing and published storefronts, owner-scoped listing CRUD, review CRUD, listing media management, and a guarded population script. Account avatars use initials with stable per-user color fallbacks or uploaded images, and are rendered in navigation, published seller storefronts, and reviews. ESLint, TypeScript, and the production build passed in GitHub Actions run 21 on 2026-10-22. Migration 0020 has not been applied or live-verified, and browser/end-to-end verification at target widths remains outstanding.

## 2. Application Structure and Boundaries

```
src/
├── app/          pages, layouts, Route Handlers, server/client boundaries
├── components/   reusable UI and feature components
├── db/           Drizzle schemas, queries, clients, seed fixtures, Storage helpers
└── lib/          shared utilities and Better Auth configuration

agent-files/      coding-agent guidance, context, and architecture authority
drizzle/          SQL migrations and Drizzle Kit metadata
scripts/          developer-run population/preflight scripts
seed/
├── images/       downloaded source media
└── snapshots/    immutable historical database snapshot
```

Listing read queries, schemas, Drizzle clients, and Storage helpers live under `src/db`. Current mutation SQL is issued from Route Handler files using the shared transaction helper in `src/db/drizzle/app-client.ts`; dedicated mutation modules have not been extracted. Server Components are the default for data fetching and rendering. Client Components are for browser-only behavior such as event handlers, interactive state, animation, client navigation, and Embla interaction.

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
- UUID `id` primary key; `name`, unique `email`, `email_verified`, nullable `image`, `saved_listings uuid[]`, `preferences jsonb`, `created_at`, and `updated_at`. Saved listings default to an empty array and have a database CHECK constraint limiting them to 100 IDs. Migration `0020_user_account_preferences.sql` adds validated `defaultSort` (`newest`, `price-low`, `price-high`) and `viewMode` (`grid`, `list`) preferences; the migration is in source and its live application status is not verified.
- `users.auth_user_id` was removed by migration `0009_remove_redundant_schema_fields.sql`. Do not refer to it as a current column or reintroduce it.
- Runtime column grants restrict user identity reads; after migration 0020, the public shared-read role may read only `id`, `name`, and `image`. Account `preferences` remain available only through the owner-scoped `evergreen_app` path.

### Saved listings

- Migration `0019_saved_listings_on_users.sql` adds `public.users.saved_listings uuid[] NOT NULL DEFAULT ARRAY[]::uuid[]` and the `users_saved_listings_max_100` CHECK constraint.
- GET/PATCH `/api/v1/users/me/saved-listings` derives identity from the verified Better Auth session; neither URL nor request body accepts a user ID. PATCH changes one listing ID at a time.
- `evergreen_app` has column-level SELECT/UPDATE on `saved_listings`, a permissive owner-only SELECT policy, a restrictive owner-only SELECT policy (to clamp inherited `evergreen_read` visibility), and an owner-scoped UPDATE policy. `evergreen_runtime` and `evergreen_auth` cannot SELECT `saved_listings`.
- Better Auth uses a dedicated Drizzle user projection that omits `saved_listings`. Migration 0019 replaces broad table-level user grants with explicit column grants for supported auth fields.
- A fixed-search-path SECURITY DEFINER trigger removes deleted listing IDs from saved arrays. Direct execution of the trigger function is revoked from PUBLIC.
- Migration 0019 has been applied to the configured Supabase project and registered in the Drizzle migration ledger. Its column, CHECK constraint, owner policies, grants, and trigger were checked via catalog queries; browser-level behavior remains unverified.

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
- users: the shared SELECT policy permits visible rows. Migration 0011 grants shared `id` and `name`; migration 0020 additionally grants shared `image` for public avatars. `email` and private `preferences` are not exposed through shared permissions.

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

The evergreen_app login originates in migration 0010 and was added to evergreen_read in migration 0011. The source includes APP_DATABASE_URL support, a dedicated app Drizzle client, owner-aware write policies, constrained grants, and migrations 0013–0018. It also contains authenticated listing create/update/delete, seller-profile CRUD, review read/create/update/delete, and media upload-url/completion/file-delete handlers. These source files do not prove that every route has been tested or deployed; the corresponding UI flows still need static and manual verification.

### Route Handlers present in source

Use Next.js App Router Route Handlers as the explicit HTTP API contract:

| Method and path | Source status | Responsibility |
|---|---|---|
| GET /api/v1/listings | Present in source | List/search/filter public listings |
| POST /api/v1/listings | Present in source | Create a listing for the current authenticated seller; enforce the three-listing cap in the database |
| GET /api/v1/listings/[id] | Present in source | Read one listing; preserve existing 404 behavior |
| PATCH /api/v1/listings/[id] | Present in source | Partially update an owned listing |
| DELETE /api/v1/listings/[id] | Present in source | Delete an owned listing |
| GET/POST/PATCH/DELETE /api/v1/seller-profiles | Present in source | Read/create/update/delete the authenticated user's profile |
| GET/POST /api/v1/listings/[id]/reviews | Present in source | Read reviews and create the authenticated user's review |
| PATCH/DELETE /api/v1/listings/[id]/reviews/[reviewId] | Present in source | Update/delete the authenticated user's review |
| POST /api/v1/listings/[id]/media/upload-url | Present in source | Request a listing-media upload URL |
| POST /api/v1/listings/[id]/media/complete | Present in source | Complete/register a listing-media upload |
| DELETE /api/v1/listings/[id]/media/[filename] | Present in source | Delete a listing media file |

These methods are exported from Next.js Route Handler files under `src/app/api/v1`. Review item routing uses the distinct `[reviewId]` parameter. Treat this table as a source inventory; it does not establish that every route has been behaviorally tested or deployed. Add methods to existing route files rather than creating duplicate handlers. PATCH is used for partial updates; add PUT only if full-resource replacement is deliberately designed.

### Write request flow used by the source

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

Write handlers must derive the owner from the verified Better Auth session, never a browser-supplied userId or seller_user_id. Current handlers perform Drizzle statements in the Route Handler and use `withAppUserTransaction` for owner-scoped writes. Keep using only APP_DATABASE_URL for app writes; never use DIRECT_URL, evergreen_runtime, or evergreen_auth for listing writes.

Use the established JSON envelope: successful reads/updates return { data: ... }; errors return { error: { code, message } }. Keep status behavior consistent: 201 for created resources, 200 for successful reads/updates, 204 for deletes with no body, 400 for invalid input, 401 for missing/invalid sessions, 404 for missing or non-owned resources, 409 for business-rule conflicts, and 500 with a generic message for unexpected errors.

### Authorization and database requirements

- Seller onboarding creates seller_profiles.user_id from the canonical users.id associated with the verified session.
- A listing's seller_user_id is derived from the current session and an eligible seller profile; clients cannot choose or reassign ownership.
- Only the owner may update or delete a listing. Existing unowned rows must remain immutable to ordinary users.
- Shared reads of seller_profiles remain limited to published profiles. The current schema has app-specific owner policies for a seller's own profile, including unpublished profiles.
- Grant only the INSERT/UPDATE/DELETE and column privileges the handlers require. Keep users and Better Auth tables outside the app writer's write scope.
- Enforce the three-active-listings-per-seller cap with concurrency-safe database logic; a plain count-then-insert check can race.
- Test anonymous writes, invalid payloads, cross-user mutations, owner reassignment attempts, unpublished-profile access, concurrent creates, and listing-cap conflicts before enabling the UI.

The app writer client sets the transaction-local `app.current_user_id` setting with `set_config` using the verified session UUID before owner-protected writes. This is defense in depth, not protection against compromise of the writer credential or arbitrary SQL under that credential.

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
- The first six listings preserve their historical IDs, core details, and media filenames. Six additional listings have stable fixture IDs. All 12 listings currently reference four media files each: two JPGs, one GIF, and one MP4.
- Review authors use stable seller keys, which scripts/populate.ts resolves to actual Better Auth user UUIDs.
- The old reviewer identities/reviews remain in the archive and are not duplicated in the new fixture dataset.
- Fixture data contains no passwords, password hashes, sessions, database URLs, or secrets. Do not add them.

The last reported checks after fixture changes were `npx tsc --noEmit`, `npx vitest run tests/data.test.ts`, and `npm run test:run`; the fixture suite passed 9 tests and the full suite passed 11 tests across 2 files. These are historical, user-reported results, not a claim that code was rerun during this documentation change.

### Developer-run population entry point — implemented, not yet verified

scripts/populate.ts defines a default read-only preflight and a separately gated apply mode. It checks the expected Supabase project, role attributes and memberships, relevant privileges, RLS policies, listing-cap trigger, fixture relationships, seller identity conflicts, existing rows, private Storage settings, local path safety, media sizes, and existing fixture media bytes.

The script can:
- Provision fixture seller accounts through Better Auth without committing passwords.
- Resolve canonical user UUIDs, then create matching seller profiles, listings, and reviews using the application writer's owner-scoped transaction helper.
- Upload missing fixture media with upsert disabled, compare existing objects byte-for-byte, and preserve unknown/unrelated objects.
- Be re-run after a partial failure without intentionally deleting or overwriting unrelated records.

Execution is exposed as npm run populate (dry-run by default) and npm run populate:dry-run. The pinned tsx runner is obtained through npx when needed. Dry-run must not require the private seed/credentials file; account passwords are loaded only for apply mode if new fixture accounts are required.

**Write mode is currently blocked** by the recorded checksum/provenance discrepancy for 0011_shared_read_role.sql. Read-only Git history shows the current file is identical to its only recorded version, but its LF and CRLF SHA-256 hashes both differ from the live ledger value. The ledger does not store the applied SQL body, so exact migration provenance remains unverified. Reconcile the discrepancy before removing that guard. Do not modify old migration files or the Drizzle migration ledger merely to make the checksum match. Do not apply population during a dry-run review, and do not run it at app startup or through a public route.

Existing fixture Storage ETags are not treated as proof of byte identity; expected existing objects are downloaded and compared with local fixture bytes. Unrelated Storage objects must remain untouched.

## 8. Schema Changes and Ownership Readiness

The seed snapshot, fixture data, and current schema now exist in the repository. Further schema cleanup is still dependency-driven and must be evaluated against application code, UI types, fixtures, tests, and migrations before changing the database.

In particular:

- Do not reintroduce removed `users.auth_user_id`, `listings.seller`, `listings.stars`, or `seller_profiles.slug` columns just because they appear in historical migrations/snapshots.
- Keep `listings.seller_user_id` nullable until every retained listing has an owner. Make it non-null only after ownership is populated and verified, with a reviewed migration.
- Decide and implement the rating aggregate queries needed by listing cards/search results as well as detail pages.
- Generate and inspect new migrations; never edit already-applied historical migrations to represent the current schema.

## 9. Supabase Storage and Media Model

The listing `media` array stores filenames, not public URLs. Runtime media uses `src/db/supabase/util/GetMediaUrls.ts` and the server-only Storage admin helper. It preserves database filename order, filters out missing filenames, and generates signed URLs. User-uploaded avatars are stored under owner-scoped `avatars/{userId}/{uuid}.{ext}` paths in the same private `property-images` bucket and are resolved to signed URLs; users without an image render their name initial with a stable generated color. Migration 0018 removes the prior public-read policy, but the repository does not establish whether it has been applied to production. Migration 0020 adds avatar column permissions and private account preferences, and is not verified as applied.

Source Route Handlers provide POST endpoints for requesting an upload URL and completing/registering a listing-media upload, plus a DELETE endpoint for a listing media file. Their presence does not establish that the full upload lifecycle has been verified or deployed.

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
APP_DATABASE_URL=       # server-only app writer using evergreen_app
SUPABASE_SECRET_KEY=    # server-only Storage admin credential
```

For Supabase shared transaction-pooler connections, use the Dashboard's copied host/port and role username format `<role>.<project-ref>`; postgres.js may require prepared statements disabled. Never expose database credentials or `BETTER_AUTH_SECRET` in client bundles or committed fixtures.

## 11. Verification and Work Order

The saved-home UI/API are present and migration 0019 is applied and registered in the Drizzle migration ledger. The column, CHECK constraint, owner policies, role grants, and listing-delete cleanup trigger were checked via read-only catalog queries. TypeScript, ESLint, production build, automated tests, and browser checks have not been run. No fixture population or Storage writes were performed.

1. Run `npm run populate:dry-run` against the configured project; confirm the saved-list contract checks pass and no database, auth, or Storage writes occur.
2. Reconcile the historical migration 0011 provenance discrepancy before population apply. Git history does not contain the version that produced the live checksum; do not edit migration 0011 or rewrite its existing ledger entry. Also byte-compare the previously flagged Storage object before considering any overwrite.
3. Manually verify card/detail save and unsave, persistence after refresh and re-authentication, anonymous/empty/populated/error Saved homes states, the 100-item cap, and deleted-listing cleanup.
4. Keep Vite+ as the last implementation-stage change; automated tests and the final security audit remain deferred until after Vite+ as requested. Preserve Next.js as the runtime unless a separate framework conversion is approved.
5. After the Vite+ work, add/expand automated tests and conduct the final security audit.

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
  │   ├─ /api/v1/listings → GET, POST
  │   ├─ /api/v1/listings/[id] → GET, PATCH, DELETE
  │   ├─ /api/v1/listings/[id]/reviews → GET, POST
  │   ├─ /api/v1/listings/[id]/reviews/[reviewId] → PATCH, DELETE
  │   ├─ /api/v1/listings/[id]/media/upload-url → POST
  │   ├─ /api/v1/listings/[id]/media/complete → POST
  │   ├─ /api/v1/listings/[id]/media/[filename] → DELETE
  │   └─ /api/v1/seller-profiles → GET, POST, PATCH, DELETE
  └─ Supabase JS Storage helper
      └─ private property-images bucket
          ├─ runtime: signed URLs
          └─ future populate script: upload seed/images assets

DIRECT_URL → Drizzle Kit migrations only
```


## Demo readiness, email verification, and mock-account policy (2026-10-23)

### Authentication policy

The source now requires email verification before public email/password sign-in, sends verification links on sign-up and unverified sign-in, and supports one-hour forgotten-password reset links with session revocation after reset. `src/lib/auth-email.ts` sends through Resend using server-only `RESEND_API_KEY` and `AUTH_EMAIL_FROM`. Real delivery and deployed callback URLs remain unverified until the provider is configured in Netlify and exercised end-to-end.

Before inviting real people to the Netlify demo:
- Keep `emailAndPassword.requireEmailVerification` enabled and test the implemented `sendVerificationEmail` flow.
- Keep `sendResetPassword`, one-hour token expiry, and `revokeSessionsOnPasswordReset` enabled; test invalid/expired/single-use tokens and session revocation.
- Configure Resend through server-only `RESEND_API_KEY` and `AUTH_EMAIL_FROM`; verify sender-domain authentication and production callback URLs in Netlify.
- Enforce that an unverified user cannot establish an authenticated session / access protected app features. Test sign-up, verification link, expired/invalid link, sign-in before verification, resend throttling, and verified sign-in.
- Configure and test rate limiting for sign-in, sign-up, verification resend, and password reset; review session lifetime, cookie security, trusted origins, HTTPS, generic responses against account enumeration, and production secrets.
- Never expose auth/database/storage secrets to client bundles or commit them.

### Synthetic mock-account exception

Mock accounts are developer-created fixtures, not public sign-ups. They need deterministic access for reviewers without relying on inboxes controlled by the developer. Keep this exception inside the local, manually invoked population script and its explicit fixture-account contract; do not weaken the global Better Auth policy.

Preferred design to implement/review:
- Keep `requireEmailVerification: true` for ordinary registrations.
- Provision only the exact, enumerated synthetic fixture emails in `src/db/seed/data.ts` through a dedicated script-only Better Auth admin/create-user API (or a narrowly scoped script-only operation supported by the installed version) that explicitly sets the fixture user's email-verified state. Do not use ordinary public sign-up as a hidden bypass and do not add a public endpoint, query parameter, environment flag exposed to the client, or email-domain wildcard to skip verification.
- Use the normal Better Auth password hashing/session/account model; do not insert plaintext passwords or hand-built password hashes directly into the database.
- Fixture passwords must be unique random local secrets from ignored `seed/credentials`; do not commit or log them. Make demo credentials available only through the intended private/demo instructions, and rotate them if exposed.
- Keep a strict allowlist matching the exact fixture emails/keys; abort if a fixture identity is not in that allowlist or already belongs to a non-fixture user. Never mark arbitrary existing users as verified.
- Add an automated test proving ordinary sign-up cannot bypass verification and that only the script's exact fixture path may mark fixture identities verified. Re-run the population dry-run after implementing this; current `scripts/populate.ts` calls `auth.api.signUpEmail` and must be deliberately updated/tested for the verification-required configuration.
- Forced password reset: if the intent is for mock accounts to require changing their initial password on first use, a verified flag alone is not enough. Add an explicit server-enforced `mustResetPassword`/credential-rotation state for fixture users (or another supported, secure equivalent), gate protected routes until completion, provide a reset/change flow, and clear the flag only after the password has actually changed. Do not confuse password-reset email delivery with forced reset: a reset email requires control of the mailbox, while mock-account first-login rotation can use an authenticated change-password flow. Do not ship a shared mock password for accounts intended for real users.

### Netlify public-demo release gate

A successful build and passing population preflight are not a release sign-off. Before opening the deployed Netlify URL to real visitors:
- [ ] Set production-only environment variables in Netlify: `BETTER_AUTH_URL`, strong `BETTER_AUTH_SECRET`, the least-privilege `AUTH_DATABASE_URL` and `APP_DATABASE_URL`, Supabase URL and server-only secret key, and transactional email provider credentials. Keep `DIRECT_URL` migration-only; do not make it available to runtime handlers if unnecessary.
- [ ] Set Better Auth's production URL/trusted origins to the exact HTTPS Netlify domain(s); verify callback URLs and secure cookies on the deployed domain and preview deployments.
- [x] Source implementation and unit tests cover mandatory verification, forgotten-password email, one-hour reset lifetime, session revocation, auth UI, and fixture-only verification bypass.
- [ ] Configure Resend credentials/sender in Netlify and end-to-end test real email delivery, invalid/expired tokens, rate limits, and production callback URLs.
- [ ] Implement forced first-login password change for seeded demo accounts if that remains a requirement; verify protected routes are blocked until it succeeds.
- [ ] Keep mock accounts synthetic, visibly documented as demo accounts, and separate from real-user registration. Never reuse real personal email addresses or real passwords in fixtures.
- [ ] Confirm RLS, role grants, private Storage, signed URL expiry, upload MIME/size/path checks, and authorization for every read/write route. Test cross-account listing/review/profile/saved-home/media access.
- [ ] Add and run tests for auth/verification/reset, ownership/IDOR, route validation, rate limits, media lifecycle, RLS/role assumptions, population safety, and fixture-only auth bypass.
- [ ] Manually test all main flows at mobile/tablet/desktop widths and keyboard-only; verify loading, error, empty, and expired-session states.
- [ ] Verify backup/restore and incident/rollback plan, privacy/terms/contact information, logging that excludes secrets/passwords/tokens, and appropriate demo data disclosure.
- [ ] Review current database and Storage contents before any cleanup; run the population script in dry-run mode after all changes, then review the exact write plan.
- [ ] Keep a written residual-risk list. Do not call the app production-ready until all critical/high findings are resolved.

### Data reset and fixture population

Do not drop/recreate the database, delete the Drizzle migration ledger, or reset role/policy objects to get a clean mock-data install. The current seed operation is additive and intentionally preserves unrelated records and Storage objects. A clean fixture reset must be a separately reviewed, explicit development-only cleanup with a backup and an exact allowlist of disposable user IDs, fixture-owned database rows, and fixture-owned Storage paths. Preserve migrations, schema, grants, RLS, triggers, and unrelated objects. The currently observed non-fixture Storage objects (including root `home-image.jpg`) must be classified before deleting anything. Never delete all users by broad predicate without tracing account/session/profile/listing/review foreign-key effects and confirming the target environment.

Migration provenance note: migration `0021_reconcile_shared_read_role.sql` reconciles the live shared-read security contract forward. The historical `0011` checksum discrepancy remains acknowledged; do not edit the historical SQL or ledger row to silence it.
