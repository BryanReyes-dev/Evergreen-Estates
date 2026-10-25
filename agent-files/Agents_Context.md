# Evergreen Estates — Working Context

> Current implementation status, verified findings, decisions, and immediate work order. ARCHITECTURE.md remains the authority for finalized architecture.

## Documentation authority

- `agent-files/ARCHITECTURE.md` is the authoritative architecture document.
- `agent-files/AGENTS.md` contains agent operating rules.
- `agent-files/CLAUDE.md` is the Claude entry point.
- Replace stale information rather than appending contradictory history.
- Distinguish implemented code from approved but unimplemented designs.

## Project and workflow

GitHub Actions is intentionally unused: `.github/workflows/quality-checks.yml` was removed on 2026-10-25 to avoid hosted-runner usage. Do not recreate CI workflows unless requested. Run test, lint, type-check, and build setup after the planned Vite+ migration.

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

The shared `evergreen_read` NOLOGIN role and migration-defined memberships/grants are in repository history. `evergreen_runtime` and `evergreen_app` inherit shared reads using `INHERIT TRUE, SET FALSE`. Migration `0011_shared_read_role.sql` grants shared identity reads for `users.id` and `users.name`; source migration `0020_user_account_preferences.sql` adds shared access to `users.image`, owner-scoped account preferences, and avatar upload permissions for `evergreen_app`. Migration 0020 is source-only in this coding pass; its live application status is not verified. Never change or force-repair the known historical 0011 provenance discrepancy to work around this.

PostgreSQL 17.6 verification on 2026-10-18 predates the app-write grants and policies in migrations 0013–0018. It confirmed shared reads and that `evergreen_runtime` could not select `users.email`; its finding that the app role lacked listing-write privileges is historical and should not be used to describe the current migration set. The four shared-read policies target `evergreen_read`, and the separate `evergreen_auth` policy on users remains in place. Current effective privileges still need verification against the target database.

Never use the runtime or auth roles for migrations. Never use `DIRECT_URL` in request handlers. Keep credentials and Better Auth secrets server-only. Do not grant general listing-write permissions to `evergreen_runtime` or `evergreen_auth`.

## Latest schema state

Migration `0009_remove_redundant_schema_fields.sql` was generated, reviewed, and applied locally through Drizzle Kit. The live Supabase schema was independently checked afterward.

### `users`

- Canonical Better Auth identity table.
- `id` is the UUID primary key.
- `name`, `email`, `email_verified`, `image`, `created_at`, and `updated_at` remain.
- Migration 0019 adds private `saved_listings uuid[]` with a database-enforced 100-ID maximum; it has been applied to the configured Supabase project and registered in the Drizzle migration ledger.
- Source migration 0020 adds a private JSONB `preferences` object with validated default sort and results layout values. It also grants owner-scoped app access to preferences and avatar updates and backfills avatar URLs only from already-published seller profiles. It has not been applied or live-verified by this implementation pass.
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

## Current implementation status (2026-10-22)

The pushed repository now includes:

- Public listing browsing, details, and URL-driven search/filtering.
- Better Auth email/password backend plus user-facing sign-up/sign-in and session-aware account navigation with initials/photo avatars.
- New `/account` settings UI for personal name, uploaded avatar, password changes, default listing sort, and results layout; seller storefronts and reviews use the account avatar. ESLint, TypeScript, and the production build passed a historical GitHub Actions run on 2026-10-22, before CI was intentionally disabled. The `.github/workflows/quality-checks.yml` workflow has been removed; do not restore GitHub Actions checks unless explicitly requested. Migration 0020 remains source-only and browser/responsive end-to-end checks have not been run.
- Seller-profile create/read/update/delete UI connected to the existing seller-profile API, plus a public storefront page for profiles explicitly marked published.
- Listing create/edit/delete UI connected to the existing listing Route Handlers, with owner-scoped edit access and a seller page listing the current user's properties.
- Review create/edit/delete controls connected to the existing review Route Handlers; only the review author sees mutation controls, and the server remains authoritative.
- Listing media upload, preview, reorder, and deletion UI connected to the media endpoints.
- Saved-home buttons on listing cards and details, Saved homes page, and GET/PATCH `/api/v1/users/me/saved-listings` backed by migration 0019.
- Synthetic fixtures and 48 local media files, plus scripts/populate.ts with read-only preflight and explicit write-mode safeguards.

Historical static checks (ESLint, `npx tsc --noEmit`, and production build) passed on 2026-10-22. GitHub Actions has been intentionally disabled by removing `.github/workflows/quality-checks.yml`; no workflow should run on pull requests. Automated tests, lint/type-check/build checks for current code, and browser/responsive verification are deferred until after the planned Vite+ migration. Account settings and private avatar upload require migration 0020 to be applied safely before runtime use.

### Population script status

- `npm run populate:dry-run` invokes the population script in read-only mode.
- The updated preflight requires migration 0019's saved-list column and 100-item CHECK constraint, verifies app/auth role grants and saved-list RLS policies, and verifies the listing-delete cleanup trigger. Those objects were confirmed present via read-only catalog checks after applying migration 0019.
- Dry-run does not require the private synthetic-seller credentials file; credentials are read only when apply mode would need to create accounts.
- Apply mode requires explicit project confirmation and remains blocked by the known unresolved 0011 shared-read migration checksum/provenance discrepancy. Do not bypass the guard or modify the Drizzle ledger to force population.
- The dry-run must still be executed and its report reviewed. Existing Storage objects must be byte-compared with local fixtures, and unrelated Storage objects must remain untouched.
- The database population operation has not been run by this pass.

### Next work order

1. Review migration `0020_user_account_preferences.sql` and its snapshot, then apply it through the repository's approved migration procedure before testing Account settings/avatar storage; confirm the column grants and default preferences with read-only catalog queries. Do not bypass the unresolved migration-0011 provenance guard.
2. Run `npm run populate:dry-run` against the configured project; inspect its report and confirm no database, auth, or Storage writes.
3. Reconcile the migration 0011 provenance discrepancy before population apply. Git history does not contain the source version matching the live checksum; do not edit the historical migration or rewrite its existing ledger entry. Byte-compare the previously flagged Storage object before considering any overwrite.
4. Manually verify account name and preference persistence, avatar upload/removal, seller-profile and review avatars, auth, listing CRUD, reviews, saved-home persistence, media management, mobile-only menu behavior, and error states at 350px, tablet, and 1140px with at least two accounts when the local app is available.
5. Keep Vite+ as the last implementation-stage change. Automated tests and the final security audit remain deferred until after Vite+ as requested; preserve Next.js as the runtime unless a separate framework conversion is approved.
6. After Vite+, run the automated test suite and final security audit, then resolve findings.

Saved homes source is implemented in this branch: migration 0019, GET/PATCH route, shared saved-state provider, card/detail save controls, and Saved homes page. Migration 0019 has been applied to live Supabase and its schema contract was checked, but saved-home workflows have not been manually verified. Public seller storefronts are implemented for profiles explicitly marked published. Rating aggregates on listing cards/search results remain a separate UI/data enhancement; listing details calculate an average from the review records they load and display an unrated state when there are no reviews.

agent-files/ARCHITECTURE.md remains the finalized architecture authority; this context records status and verification boundaries.

## Media and implementation invariants

- Listing `media` arrays store filenames rather than public URLs.
- Media remains categorized as `image` or `video`; GIF is an image.
- `GetMediaUrls.ts` preserves database media order, filters out filenames absent from Storage, and generates signed URLs through the server-only Storage admin helper.
- Keep the Supabase Storage bucket private.
- Keep `src/lib/netlifyImageLoader.ts` and the local-development versus production image optimization behavior intact.
- Use the installed Next.js 16 documentation before framework-sensitive changes.


## Netlify demo readiness and mock account policy (updated 2026-10-25)

### Authentication email implementation status (2026-10-25)

Source now requires email verification before email/password sign-in, sends verification links on sign-up and unverified sign-in, and uses one-hour verification tokens. Forgotten-password email uses Better Auth's reset flow with one-hour tokens and session revocation after reset. The `/auth` form includes a verification confirmation/resend state and forgot-password link; `/auth/forgot-password` and `/auth/reset-password` implement the reset-request and token-consumption screens.

`src/lib/auth-email.ts` sends branded HTML/text messages through Resend using server-only `RESEND_API_KEY` and `AUTH_EMAIL_FROM`. Configure real values in local `.env` and Netlify, and verify the sender domain. Source code and unit tests do not prove real inbox delivery or production callback URLs. Auth endpoint rate limits are configured; the built-in memory limiter is per runtime instance, so distributed/serverless rate limiting remains a release review item.

For non-fixture users, configure mandatory Better Auth email verification with the installed version's supported API, a real transactional email provider, production callback URLs, rate limiting for sign-in/sign-up/resend/reset, secure session/cookie settings, trusted origins, and generic responses that limit account enumeration. Verify that unverified accounts cannot establish usable authenticated sessions or access protected features. Configure password reset delivery and test token expiry/single-use behavior.

### Population and synthetic account exception

The intended mock seller accounts must be usable for a demo without requiring a developer to click verification links for each one. This must be a narrow, script-only exception, not a global bypass:
- Keep verification mandatory for normal public registration.
- `scripts/populate.ts` provisions credentials through Better Auth, then updates `email_verified` only for identities passing the script-only `src/db/seed/auth-fixtures.ts` exact email + name allowlist and a matching user UUID.
- Public registration and request handlers do not import the fixture allowlist. Do not add a public verification-bypass endpoint or flag. Test coverage is intentionally deferred until after the Vite+ migration.
- Continue to use ignored local `seed/credentials`, random unique passwords, explicit target project confirmation, dry-run, and no credential logging.
- If demo accounts should be forced to rotate their initial password, add an explicit server-enforced first-login password-change state and block protected app routes until the password changes. Email reset and forced first-login change are different features; reset-email delivery requires mailbox access.
- Add tests showing normal registration requires verification and the seed-only exception works only for enumerated fixture accounts. The populate script now marks only exact allowlisted fixture identities as verified. Public sign-up remains verification-gated.

### Required release gates before opening the Netlify demo to real users

- [ ] Netlify production env is configured with the exact HTTPS `BETTER_AUTH_URL`/trusted origin, strong `BETTER_AUTH_SECRET`, least-privilege `AUTH_DATABASE_URL` and `APP_DATABASE_URL`, Supabase URL/server-only key, and email provider credentials. Keep `DIRECT_URL` migration-only.
- [x] Source implementation exists for required verification, reset email callbacks, one-hour token lifetime, session revocation after reset, auth screens, and fixture-only verification bypass. Automated tests are intentionally deferred until after the Vite+ migration.
- [ ] Configure Resend in local `.env` and Netlify; verify inbox delivery, sender-domain authentication, callback URLs, expired/single-use tokens, and abuse controls end-to-end.
- [ ] Decide and implement forced password rotation for seeded demo accounts if required.
- [ ] Test cross-account authorization for listings, reviews, seller profiles, saved homes, avatars and listing media; verify role grants/RLS and private bucket behavior.
- [ ] After the Vite+ migration, run auth/route/RLS/IDOR/media/population tests and full type/lint/build checks locally. No GitHub Actions workflow is currently configured.
- [ ] Manually verify desktop/tablet/mobile, keyboard navigation, error/loading/empty states, session expiry and sign-out.
- [ ] Check Netlify preview versus production environment variables, callback URLs, cookies, secrets, logging, privacy/terms/contact and demo-data disclosure.
- [ ] Record backup/restore and rollback plan; review all database and Storage objects before any destructive cleanup.
- [ ] Rerun `npm run populate:dry-run`, inspect all planned writes and Storage matches, then use the explicit confirmed-project apply command only after approval.
- [ ] Resolve critical/high security findings and document remaining known limitations before sharing publicly.

### Current live state and requested clean mock install

Read-only catalog review observed 2 users, 1 seller profile, 2 listings, 1 review, 2 Better Auth accounts, 6 sessions, 0 verification rows, and 20 objects in private `property-images`. The last dry-run passed all role/grant/RLS/trigger/Storage-policy checks, plans 4 fixture sellers, 12 listings, 48 reviews, and 48 media assets, and reports 14 existing expected objects byte-verified/skipped plus 34 missing. No write has been run by that dry-run.

The 20 Storage objects include 18 under `listings/`, one under `avatars/`, and root `home-image.jpg`; classify them before deleting. The current populate script is additive, will not remove the two current users or unrelated objects, and does not currently provide a clean-reset mode. Do not add a broad destructive flag to the default population command.

A clean fixture install is optional; Vite+ itself does not require wiping Supabase. If the user confirms cleanup, first produce an exact reviewed deletion manifest for the two current non-fixture identities and their dependent rows plus only known disposable media, preserve schema/migrations/roles/policies/triggers and unknown Storage objects, and verify a backup. Do not use `TRUNCATE CASCADE`, reset the schema, delete the migration ledger, or delete all Storage objects. Use a separate, explicit, development-only cleanup procedure and rerun the dry-run before population apply.

Migration 0021 is applied and live security checks pass; the historical 0011 checksum mismatch remains acknowledged, not repaired. Never rewrite migration 0011 or its ledger row.
