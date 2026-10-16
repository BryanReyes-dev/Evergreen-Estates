# Evergreen Estates — Working Context

> Working notes for Bryan and coding agents. This file records current implementation status, verified findings, decisions, and the immediate work sequence. It is not the authoritative architecture document.

## Documentation authority

- `agent-files/ARCHITECTURE.md` is the only architecture authority.
- `agent-files/AGENTS.md` contains working rules for agents.
- `agent-files/CLAUDE.md` is the Claude entry point.
- Keep this file current; replace obsolete state instead of accumulating conflicting history.
- Distinguish code that exists and has been verified from intended work that has not been implemented.

## Project and branch

Evergreen Estates is a Next.js App Router real-estate marketplace using TypeScript, React, Supabase/PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

Current working branch: `feat/better-auth-drizzle-integration`.

The user prefers an incremental, local-first workflow: explain one small change, let Bryan make it locally, then review the diff/output and test result. Do not silently make unrelated code changes or skip ahead. Explicit permission was given to update agent documentation, including ARCHITECTURE, in the current documentation task.

## Current implemented functionality

- Public browsing, listing detail pages, URL-based search/filtering, review display, and listing media presentation.
- Application table reads use Drizzle through `src/db/queries/listings.ts` and the dedicated, read-only `evergreen_runtime` PostgreSQL login configured by `DRIZZLE_DATABASE_URL`.
- Supabase JS is used for Storage operations, not application-table queries.
- Better Auth email/password authentication is integrated.
- `src/lib/auth.ts` lazily creates Better Auth using `drizzleAdapter` and maps Better Auth's logical `user` model to the existing `public.users` table.
- `src/db/drizzle/auth-client.ts` uses the separate `AUTH_DATABASE_URL` connection and the restricted `evergreen_auth` PostgreSQL login.
- `src/db/auth-schema.ts` defines the `account`, `session`, and `verification` tables and their RLS policies.
- `src/app/api/auth/[...all]/route.ts` exposes the Better Auth GET/POST handlers.
- `src/lib/auth-client.ts` exposes the same-origin browser auth client.
- Listing GET endpoints exist at `/api/v1/listings` and `/api/v1/listings/[id]`. Their current missing-listing behavior has been tested locally and is intentionally left unchanged.
- The auth registration, sign-in, session retrieval, and sign-out flow was manually tested locally. Registration created linked user, credential-account, and session records; authenticated session retrieval succeeded and sign-out cleared the session.
- User-reported local checks have passed: `npx tsc --noEmit`, `npm run build`, `npx drizzle-kit check`, `npm run test:run`, and `npx drizzle-kit migrate`. Treat these as the last reported results, not proof that later unverified edits were tested.

## Connection and role boundaries

- `DRIZZLE_DATABASE_URL` → `evergreen_runtime`; read-only application access.
- `AUTH_DATABASE_URL` → `evergreen_auth`; Better Auth access to the canonical `users` identity table and the `account`, `session`, and `verification` tables.
- `DIRECT_URL` → privileged Drizzle Kit migration connection only.
- Never use the runtime or auth logins for migrations, and never use the privileged migration connection in a request handler.
- Keep every database URL and Better Auth secret server-only. Never put credentials in committed fixtures or a `NEXT_PUBLIC_` environment variable.

The separate application-write role, currently referred to as `evergreen_app`, and its environment variable/Drizzle client are **not implemented yet**. Do not grant listing writes to `evergreen_runtime` or `evergreen_auth`. The exact app-write connection variable must be chosen consistently when implementing the writer client; the existing runtime/auth credentials remain separate.

## Current database state and legacy mock data

The current Supabase project contains six established mock listings. Their current stable IDs, listing fields, and existing review/media relationships must be captured before modifying the schema or removing legacy columns.

The six existing records are:

| Listing | Current price | Beds | Baths | Existing reviews |
|---|---:|---:|---:|---:|
| Modern Luxury Villa | $850,000 | 5 | 4 | 3 |
| Private Country Estate | $1,200,000 | 6 | 5 | 0 |
| Cozy Suburban Family Home | $410,000 | 3 | 2 | 0 |
| Modern Townhouse with Garage | $520,000 | 3 | 3 | 0 |
| Affordable City Apartment | $280,000 | 1 | 1 | 0 |
| Downtown Skyline Condo | $620,000 | 2 | 2 | 0 |

All six currently have `seller_user_id = NULL` and the legacy `seller` label set to `Admin`. The three existing reviews belong to the Modern Luxury Villa and reference existing mock public-user rows named Alex Johnson, Sarah Williams, and Michael Brown. Those three users did not have Better Auth credential-account records when checked. A separate Evergreen Test user does have an auth account/session from the manual auth test; do not mistake that test record for intentional portable seed data.

The `property-images` Supabase Storage bucket is private. It currently has 14 files in the six listing-specific folders, including JPEGs, a GIF, and an MP4. The current media helper builds Storage paths under `listings/<listing-id>/<filename>` and resolves filenames into signed URLs. Preserve the bucket privacy and path layout.

### Seed data and media direction — approved principles, implementation pending

- Move the project's intentional mock records out of the live database and into version-controlled repository fixtures, so a fresh environment can recreate the dataset and schema cleanup can be based on explicit requirements rather than legacy data that only exists in one database.
- The proposed fixture module is `src/db/seed/data.ts`. It will export editable definitions for seed users, seller profiles, listings, reviews, and any required related mock records.
- The proposed executable entry point is `scripts/populate.ts`. It will import the fixture data and export/call one `populate()` function. Avoid a second redundant `populate.ts` module under `src/db/seed` unless a concrete need emerges.
- Package the original media assets under `seed/images/listings/<listing-id>/<filename>` in the repository. Those are source assets for population, not public runtime URLs.
- The population script must upload the local assets to the **private Supabase Storage bucket** at the established `listings/<listing-id>/<filename>` paths. The app must continue to use the bucket and signed-URL helper; do not replace the intentional Storage design with `public/seed/images` paths.
- Preserve the six existing listings and their useful original IDs/fields/media/reviews; add six more data-rich listings for an initial 12-listing mock dataset, preferably four synthetic sellers with up to three seeded listings each. Review fixture references should resolve by stable seed keys/emails or IDs instead of assuming Better Auth generates the same user UUID in every database.
- Seed records must be editable by someone who clones the repo. Do not commit credentials/password hashes or allow visitors to trigger population.
- `populate()` is intentionally **not to be finalized or implemented before CRUD**. Its contract, conflict handling, and reseed behavior depend on the completed ownership model and listing API/schema.

No database rows have been exported to repository fixture files yet. Keep the current database data intact until a portable copy and a verification plan exist.

## Immediate work sequence

1. **Capture and preserve the current mock dataset.** Export all six listing records and all associated review/user fields needed to reproduce them. Download/copy the 14 existing Storage assets into the repository's source-asset layout, retaining listing folder IDs and filenames. Confirm completeness before any cleanup. Do not create the final population script yet.
2. **Finish secure listing CRUD.** Keep public GET routes working; implement authenticated POST/PATCH/DELETE Route Handlers with server-side input validation and Better Auth session verification.
3. **Implement profile onboarding and write isolation.** New listing creation requires the authenticated user to have a seller profile. Use a separate least-privilege app-write role/connection, ownership-aware RLS, and transaction-local identity propagation that is set only from the verified Better Auth session. Never make the public or runtime role writable. Existing listings should not become editable by ordinary users until their owner relationship is explicitly seeded/backfilled.
4. **Enforce three active listings per seller.** Check the limit on the server/database side with concurrency-safe handling; also test cross-user mutation attempts, unauthenticated requests, invalid inputs, and repeated requests. Consider registration/create rate limits as separate abuse controls.
5. **Audit and simplify the schema only after fixtures and CRUD are ready.** Search the entire source, Drizzle definitions, migrations, query helpers, UI types, and tests for every candidate column. Likely candidates for review include transitional `users.auth_user_id`, the legacy denormalized `listings.seller` display field, and nullable `listings.seller_user_id`. These are candidates, not authorized deletions: remove/alter only after code and data dependencies are addressed, a migration is prepared, and the recreated fixture dataset is verified. Preserve fields that remain product requirements.
6. **Finalize `data.ts` and `populate()` after the CRUD/schema design is stable.** Population should be safe to repeat, report inserts/updates/skips, avoid deleting unrelated user data by default, support the private Storage upload path, verify existing fixtures, and explicitly guard against accidentally targeting production.
7. **Connect CRUD to the UI** and run local type-check, build, tests, migration checks, and targeted authorization tests.

## Known implementation gap

The listing routes currently support GET only. The owner-aware RLS policies and `evergreen_app` writer role/client have not yet been added to `src/db/schema.ts`/migrations. The previous proposed ownership-policy edit is therefore still pending. The user has decided that fixture extraction/data preservation comes first, CRUD comes next, and the final `populate()` architecture comes after CRUD rather than before it.

## Media and image rendering invariants

- Listing media remains categorized only as `image` or `video`; GIF is `image`.
- `src/db/supabase/util/GetMediaUrls.ts` discovers files in the private Storage bucket, preserves database media ordering, appends files present in Storage but missing from the database array, and creates signed URLs.
- Signed URL query strings/fragments are ignored for media-type classification.
- `src/lib/netlifyImageLoader.ts` provides Netlify Image CDN URLs in production. Local development sets `images.unoptimized` to true so it uses the original source URL.
- Do not alter this local-vs-production behavior or replace Supabase Storage without an explicit design change.

## Working style for the next sessions

Make one small local change at a time, explain why it exists, and ask Bryan to run the relevant command/test before proceeding. Inspect actual source and installed Next.js 16 documentation before framework-sensitive edits. Do not claim tests passed unless their output was observed or the user reported it.