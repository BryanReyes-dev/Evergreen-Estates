<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework-sensitive code. In monorepos, resolve the installed Next.js package from the applicable app directory. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Evergreen Estates Agent Instructions

Evergreen Estates is a full-stack real-estate web application using Next.js 16 App Router, TypeScript, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

## Before Working

1. Read `agent-files/Agents_Context.md` for the latest implementation status, verified findings, blockers, and immediate work order.
2. Read `agent-files/ARCHITECTURE.md` for finalized architecture and explicitly labeled planned decisions.
3. Read the relevant installed Next.js documentation under `node_modules/next/dist/docs/` when changing framework-sensitive behavior.
4. Inspect the source, schema, migrations, and tests that touch the intended change before editing.
5. Distinguish implemented code from plans. Do not treat old README text, historical migrations, or archive snapshots as proof of current implementation.
6. Work incrementally: propose one focused local edit, explain why it is needed, let Bryan apply/run it, and review the resulting diff and command output before advancing. Do not silently make unrelated code/repository changes.

## Project Boundaries

- Keep application-table queries and writes behind the established `src/db` boundary.
- Preserve the Server Component / Client Component separation unless a feature requires browser interactivity.
- Keep URL-driven filtering and the current server-side Drizzle GET path intact while implementing CRUD.
- Use Next.js App Router Route Handlers under src/app/api/v1 for explicit REST-style HTTP endpoints; do not introduce a separate Express server or substitute Server Actions for the HTTP API.
- Do not change the current listing GET-by-ID 404 behavior without a demonstrated reason; it has been tested locally.
- Do not introduce unrelated framework or infrastructure changes during focused work.
- Keep listing media limited to the established `image` and `video` categories. GIF remains an image.
- Do not switch application-table operations from Drizzle to Supabase JS; Supabase JS is the Storage helper client.

## REST API and Route Handlers

- The source implements `GET /api/v1/listings` and `POST /api/v1/listings`; `GET /api/v1/listings/[id]`, `PATCH /api/v1/listings/[id]`, and `DELETE /api/v1/listings/[id]`; seller-profile POST/GET/PATCH/DELETE at `/api/v1/seller-profiles`; review list GET/POST; review-item PATCH/DELETE; and listing-media upload-URL, completion/registration, and deletion endpoints.
- **Known implementation defect:** the review-item handler is under `src/app/api/v1/listings/[id]/reviews/[id]/route.ts` but reads `params.reviewId`. Rename the inner folder to `[reviewId]` before considering review updates/deletes complete. The public URL shape does not change.
- Preserve the current listing GET-by-ID 404 behavior.
- Use Next.js App Router Route Handlers under `src/app/api/v1` for explicit REST-style HTTP endpoints; do not introduce a separate Express server or substitute Server Actions for the HTTP API.
- Treat every Route Handler as a public HTTP entry point. Authenticate and authorize each mutation on the server, validate the body and allowed fields, and aim for the established `{ data: ... }` success / `{ error: { code, message } }` error envelope. Some current handlers use inconsistent string-valued error bodies; do not assume response-envelope consistency.
- Use status codes consistently: 201 for creation, 200 for reads/updates, 204 for a delete with no body, 400 for invalid input, 401 for missing/invalid sessions, 404 for missing or non-owned resources, 409 for business-rule conflicts, and a generic client-safe 500 for unexpected failures.
- Resolve ownership from the verified Better Auth session, never request-body IDs. Reject or ignore client attempts to set `seller_user_id`, `userId`, or equivalent ownership fields.
- Keep handlers thin: delegate application-table operations to `src/db` query/mutation modules and use only the connection appropriate to the operation. Server Components should call the data layer directly instead of HTTP-fetching this app's own Route Handler.

## Authentication and Database Security

- Better Auth maps its logical `user` model to the canonical `public.users` table; there is no separate Better Auth user table.
- `AUTH_DATABASE_URL` / `evergreen_auth` is for Better Auth identity and auth-table operations only.
- `DRIZZLE_DATABASE_URL` / `evergreen_runtime` is read-only for application-table queries.
- `APP_DATABASE_URL` / `evergreen_app` is the dedicated app-write connection, implemented in `src/db/drizzle/app-client.ts`. Application mutations must use `withAppUserTransaction` and the user ID returned from the verified Better Auth session helper.
- `evergreen_read` is the NOLOGIN shared-read role. Migration 0011 supplies grants and role memberships not fully expressed by Drizzle Kit; migrations 0012–0016 add app writes, owner-aware RLS, the listing cap, and review/profile delete permissions.
- The policies for review INSERT/UPDATE/DELETE and seller-profile DELETE in migration 0016 are missing from the current `src/db/schema.ts` and `drizzle/meta/0016_snapshot.json`. Reconcile source/snapshot metadata with actual database state before the next generated schema migration; don't blindly generate duplicate policy SQL.
- The existing app-role review INSERT grant only includes `listing_id`, `user_id`, `rating`, and `comment`. The fixtures also define review `id`, `created_at`, and `updated_at`; if these values must be persisted by the populate script, add the narrow extra column privileges in a new forward migration. Never rewrite applied migration SQL.
- `DIRECT_URL` is reserved for Drizzle Kit migrations; never use it in request handlers or for seeding. Do not write application data through `evergreen_runtime` or `evergreen_auth`.
- Never trust a user ID or ownership field from the request body. Seller-profile onboarding must associate the profile with the authenticated canonical `users.id`.
- The three-listings-per-seller cap is implemented in the database using concurrency-safe locking; keep the database trigger as the final guard.
- Existing unowned listings must not become mutable to ordinary users until their ownership is deliberately assigned.
- Keep all database URLs, Better Auth secrets, and the Supabase Storage secret server-only.

## Schema and Migrations

- Current schema declarations live in `src/db/schema.ts` and `src/db/auth-schema.ts`; inspect these along with migrations and snapshots before changing database behavior.
- Migration 0009 removed `users.auth_user_id`, `listings.seller`, `listings.stars`, and `seller_profiles.slug`; do not reintroduce them because they appear in historic files.
- Migration 0010 created the `evergreen_app` role; migration 0011 created `evergreen_read` and its memberships; migrations 0012–0016 add policies/grants and the listing-cap trigger. Presence on the Git branch is not proof that all are applied to the live database.
- `listings.seller_user_id` remains nullable until all retained listings have owners. Do not make it non-null until ownership is reconciled and a reviewed forward migration is ready.
- Review the current 0016 schema/snapshot mismatch before generating subsequent migrations. Never rewrite already-applied SQL migration files to make them resemble current source. Prefer forward-only migrations and carefully reconcile snapshots.
- Ratings are derived from review records; never add aggregate `stars` back to listings.

## Mock Data, Historical Archive, and Storage

- The historical archive at `seed/snapshots/existing-mock-data.json` is immutable. Do not edit it to match the new schema or use it as the new seed dataset.
- The intended fixture data lives in `src/db/seed/data.ts`; `tests/data.test.ts` validates it but does not write to the database.
- Fixtures currently contain four synthetic sellers, 12 listings, and 48 reviews. Each seller owns three listings. All four sellers review all 12 listings (including their own) intentionally for mock data.
- The first six listings reference 14 listing-media files stored under `seed/images/listings/<listing-id>/<filename>`. The six additional listings currently have empty media arrays. `seed/images/home-image.jpg` is separate from listing media.
- The last documented live database state had zero listings/reviews/profiles and one separate manually tested Evergreen Test user/account/session. Recheck live DB and Storage state before population or destructive operations; the test identity is not fixture data. The last documented Storage inventory was 14 listing-folder objects plus the root `home-image.jpg`; recheck before acting.
- `scripts/populate.ts` does not exist yet. Before writing it, fix the review route-parameter defect, resolve the review INSERT column-grant decision, and reconcile the 0016 policy/schema/snapshot drift.
- Use Better Auth's supported server-side signup API to provision missing synthetic identities; don't insert user/account/session records manually or store passwords/hashes in fixtures. If a fixture identity already exists, reconcile it safely without overwriting credentials or claiming arbitrary data as seed-managed.
- The future population operation must preflight every fixture and local media path before writing, be repeatable after partial failure, report inserts/updates/skips/failures, have a non-writing dry-run plus explicit write opt-in, refuse production/preview environments, and avoid deleting unrelated rows or Storage files.
- Upload only fixture-referenced assets to the private bucket using `listings/<listing-id>/<filename>`. Keep `home-image.jpg` untouched unless deliberately included by an explicit, separate design.
- Never commit reusable seed passwords, password hashes, sessions, database URLs, auth secrets, or service-role credentials. Population must never run from app startup or a public route.

## Image Pipeline

The project uses `src/lib/netlifyImageLoader.ts` for production image optimization through Netlify Image CDN.

- In development, `next.config.ts` sets `images.unoptimized` to `true`, so local `next dev` uses source URLs and does not request the Netlify-only `/.netlify/images` endpoint.
- In production, the custom loader generates `/.netlify/images` requests.
- `netlify.toml` allowlists the project's Supabase remote image host.
- Do not change this environment-aware behavior without checking both local development and Netlify production behavior.

## Documentation Authority

- `agent-files/ARCHITECTURE.md` is the authoritative architecture document.
- `agent-files/Agents_Context.md` is current working context and task status; replace stale information instead of accumulating contradictory history.
- `agent-files/AGENTS.md` contains operating rules for coding agents.
- `agent-files/CLAUDE.md` is the Claude entry point.
- The root README is human-facing and should describe implemented behavior, not future plans.
- Documentation must distinguish implemented fixtures and historical archival from the still-planned population operation.
