<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework-sensitive code. In monorepos, resolve the installed Next.js package from the applicable app directory. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Evergreen Estates Agent Instructions

Evergreen Estates is a full-stack real-estate web application using Next.js 16 App Router, TypeScript, Supabase/PostgreSQL and Storage, Drizzle ORM, Better Auth, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

## Before Working

1. Read `agent-files/Agents_Context.md` for current verified status, blockers, and task order.
2. Read `agent-files/ARCHITECTURE.md` for finalized architecture and explicitly labeled planned decisions.
3. Read the relevant installed Next.js documentation under `node_modules/next/dist/docs/` when changing framework-sensitive behavior.
4. Inspect the source, schema, migrations, and tests that touch the intended change before editing.
5. Distinguish code that exists from plans. Do not treat old README text or working notes as proof of implementation.
6. Work incrementally: propose one concrete local edit, explain why, let Bryan apply/run it, and review the resulting diff and test output before advancing. Do not silently make unrelated code or repository changes.

## Project Boundaries

- Keep application-table queries and writes behind the established `src/db` boundary.
- Preserve the Server Component / Client Component separation unless the requested feature requires browser interactivity.
- Keep URL-driven filtering and the current server-side Drizzle GET path intact while implementing CRUD.
- Do not change the current listing GET-by-ID 404 behavior without a demonstrated reason; it has been tested locally.
- Do not introduce unrelated framework or infrastructure changes during focused work.
- Keep listing media limited to the established `image` and `video` categories. GIF remains an image.
- Do not switch application table operations from Drizzle to Supabase JS; Supabase JS remains the Storage helper client.

## Authentication and Database Security

- Better Auth is integrated and maps its logical `user` model to the canonical `public.users` table.
- `AUTH_DATABASE_URL` / `evergreen_auth` is for Better Auth only.
- `DRIZZLE_DATABASE_URL` / `evergreen_runtime` is read-only.
- `DIRECT_URL` is reserved for Drizzle Kit migrations; never use it in request handlers.
- Authenticated listing writes are not implemented yet. The proposed `APP_DATABASE_URL` / `evergreen_app` write path and ownership-aware RLS must be implemented and tested before enabling mutations.
- Never trust a user ID or ownership field from the request body. Resolve identity from the verified Better Auth session.
- Apply the three-listing cap on the server with concurrency-safe handling; client-side UI restrictions alone are insufficient.
- Preserve the current unowned seed/legacy listings from ordinary user writes until ownership has been explicitly assigned.
- Keep all database URLs and auth secrets server-only.

## Mock Data, Seeding, and Storage

- Preserve the existing six listings, their reviews, stable IDs where practical, and all related mock fields before schema cleanup.
- Move intentional mock records into editable repository fixtures so new developers can recreate the dataset. Do not finalize or implement the `populate()` script until CRUD, ownership, and schema decisions are stable.
- Planned structure: `src/db/seed/data.ts` exports fixture data; `scripts/populate.ts` imports it and owns the `populate()` entry point; bundled media assets live under `seed/images/listings/<listing-id>/<filename>`.
- Keep the Supabase `property-images` bucket private. The app resolves media under `listings/<listing-id>/<filename>` and delivers signed URLs. The future population script must upload bundled source assets into that bucket; do not replace this design with direct `public/seed/images` URLs.
- Do not commit seed-account passwords, hashes, secrets, or database credentials. Population is a developer operation, never a public route or automatic app-startup hook.
- Before dropping any suspected legacy column, search all code, types, fixtures, tests, and migrations; remove it only after a data-preserving migration and end-to-end verification.

## Image Pipeline

The project uses `src/lib/netlifyImageLoader.ts` for production image optimization through Netlify Image CDN.

- In development, `next.config.ts` sets `images.unoptimized` to `true`, so local `next dev` uses source URLs and does not request the Netlify-only `/.netlify/images` endpoint.
- In production, the custom loader generates `/.netlify/images` requests.
- `netlify.toml` allowlists the project's Supabase remote image host.
- Do not change this environment-aware behavior without checking both local development and Netlify production behavior.

## Documentation Authority

- `agent-files/ARCHITECTURE.md` is the only authoritative architecture document.
- `agent-files/Agents_Context.md` is short-term context and implementation status; replace stale notes rather than accumulating contradictory history.
- `agent-files/AGENTS.md` contains agent operating rules.
- `agent-files/CLAUDE.md` is a lightweight include file for Claude.
- The root README is human-facing and should describe implemented behavior, not future plans.
- Bryan explicitly approved editing ARCHITECTURE in October 2026 to align it with the current authentication implementation and the planned CRUD / data-portability sequence. Future architecture changes still require explicit approval before being recorded as finalized decisions.
