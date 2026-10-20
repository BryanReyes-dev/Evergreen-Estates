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

- Listing GET and POST /api/v1/listings and GET /api/v1/listings/[id] are present in the current checkout; listing PATCH/DELETE are not present.
- Seller-profile GET/POST/PATCH/DELETE and review create/update/delete handlers are present in the current checkout. The review item route uses `[reviewId]`.
- These files include uncommitted changes. Review and test them before treating behavior as complete or deployed. Do not implement another copy of an endpoint that already exists locally.
- Treat every Route Handler as a public HTTP entry point. Authenticate and authorize each mutation on the server, validate the body and allowed fields, and return JSON using the existing { data: ... } success / { error: { code, message } } error shape.
- Use status codes consistently: 201 for creation, 200 for reads/updates, 204 for a delete with no body, 400 for invalid input, 401 for missing/invalid sessions, 404 for missing or non-owned resources, 409 for business-rule conflicts, and a generic client-safe 500 for unexpected failures.
- Resolve ownership from the verified Better Auth session, never request-body IDs. Reject or ignore client attempts to set seller_user_id, userId, or equivalent ownership fields.
- Keep handlers thin: delegate application-table operations to src/db query/mutation modules and use only the connection appropriate to the operation. Server Components should call the data layer directly instead of HTTP-fetching this app's own Route Handler.

## Authentication and Database Security

- Better Auth maps its logical `user` model to the canonical `public.users` table; there is no separate Better Auth user table.
- `AUTH_DATABASE_URL` / `evergreen_auth` is for Better Auth identity and auth-table operations only.
- `DRIZZLE_DATABASE_URL` / `evergreen_runtime` is read-only for application-table queries.
- evergreen_read is the NOLOGIN shared-read role. RLS read policies in src/db/schema.ts target it; applied migration 0011 supplies grants and role memberships not fully expressed by Drizzle Kit.
- evergreen_runtime and evergreen_app inherit evergreen_read with INHERIT TRUE and SET FALSE. The runtime role remains read-only.
- Migrations 0013–0018 add limited write grants and owner-aware policies in the current checkout; verify their application and the effective database privileges before relying on them.
- APP_DATABASE_URL support and a dedicated app Drizzle client exist in the current checkout, along with local write grants and owner-aware policies. Verify the migrations are applied and authorization behavior is tested before relying on them; do not route writes through the read or auth connection.
- DIRECT_URL is reserved for Drizzle Kit migrations; never use it in request handlers.
- Never trust a user ID or ownership field from the request body. Resolve owner identity from the verified Better Auth session on the server.
- Seller-profile onboarding must associate the profile with the authenticated canonical `users.id`.
- Apply the three-active-listings-per-seller cap server-side with concurrency-safe handling; a client-side restriction or plain count-then-insert is insufficient.
- Existing unowned listings must not become mutable to ordinary users until their ownership is deliberately assigned.
- Keep all database URLs and auth secrets server-only.

## Schema and Migrations

- Current schema is defined in `src/db/schema.ts` and `src/db/auth-schema.ts`; inspect them and the relevant migrations before changing database behavior.
- src/db/schema.ts declares evergreenReadRole and the four shared-read RLS policies. Applied migration 0010 creates evergreen_app; applied migration 0011 creates evergreen_read, grants shared reads and memberships, removes runtime's redundant direct reads, and recreates the four policies for the shared role. These migrations are applied history and must not be rewritten.
- PostgreSQL 17.6 verification on 2026-10-18 confirmed both login roles can read listings, evergreen_app cannot insert/update listings, and evergreen_runtime cannot select users.email.
- Migration `0009_remove_redundant_schema_fields.sql` removed `users.auth_user_id`, `listings.seller`, `listings.stars`, and `seller_profiles.slug`. Do not reintroduce these removed columns because they appear in historical migrations or snapshots.
- `listings.seller_user_id` is currently nullable. Do not make it non-null until every retained listing has a valid seller owner and a reviewed migration is ready.
- Ratings are derived from review records; do not add aggregate `stars` back to listings.
- Never rewrite already-applied migration files to match the current schema. Generate and review a new migration for a schema change.

## Mock Data, Historical Archive, and Storage

- The historical archive at `seed/snapshots/existing-mock-data.json` is committed and should remain an immutable record of the old database state. Do not edit it to match the new schema or use it as the intended seed dataset.
- The intended fixture dataset is implemented in `src/db/seed/data.ts`; its pure validation suite is `tests/data.test.ts`. It currently defines four synthetic sellers, 12 listings, and 48 reviews. Each seller owns three listings; every seller reviews all listings, including their own, by deliberate mock-data design.
- The first six fixture listings preserve the prior listing IDs, core details, and media filenames; the six additional fixtures currently have no media.
- The previous live database records were cleared before migration 0009. The last verified database state recorded in `Agents_Context.md` had no listings, reviews, or seller profiles, and retained one separate test user/account/session. Recheck the live database before any destructive operation; never treat that test identity as seed data.
- The private Supabase `property-images` bucket last contained 15 objects totalling 39,998,905 bytes: 14 listing-folder objects and root object `home-image.jpg`. All 15 were reported downloaded and verified under `seed/images/`. Recheck live Storage before any destructive operation.
- Keep the bucket private. Listing fixture media stores filenames; runtime resolves `listings/<listing-id>/<filename>` to signed URLs with `src/db/supabase/util/GetMediaUrls.ts`. Never replace this with public local media URLs.
- Planned media source paths are `seed/images/listings/<listing-id>/<filename>`; align fixture filenames and Storage object paths exactly.
- `scripts/populate.ts` has not been implemented. Fixture definitions and pure validation tests are not a database population mechanism.
- The future developer-run population operation must provision seller identities through a supported Better Auth flow, resolve UUID relationships, safely repeat without duplicate seed-managed data, upload to private Storage, avoid deleting unrelated data by default, and include explicit production safeguards.
- Never commit reusable seed passwords, password hashes, database URLs, sessions, auth secrets, or other credentials. Population must never run from application startup or a public route.
- Before removing or changing any other schema field, search current source, types, fixtures, tests, and migrations for dependencies and plan a data-preserving migration.

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
