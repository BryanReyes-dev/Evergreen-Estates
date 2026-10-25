# Evergreen Estates — Working Context

> Short-lived implementation status and next actions. The architecture authority is [ARCHITECTURE.md](./ARCHITECTURE.md); update this file when verified project state changes.

Last reviewed: 2026-10-25.

## Documentation authority

- [../README.md](../README.md) — human-facing overview, setup, tests, and deployment notes.
- [AGENTS.md](./AGENTS.md) — coding-agent operating rules.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — durable architecture, security boundaries, and schema decisions.
- [CLAUDE.md](./CLAUDE.md) — Claude Code entry point that imports the three agent documents.
- Do not create a second handoff or architecture document. Replace stale statements in the authoritative files rather than appending contradictory history.

## Project status

Evergreen Estates is a Next.js 16 App Router property marketplace. Vite+ is the development check/test workflow; it does not replace Next.js as the app runtime. The active documentation/application branch for this work is `chore/vite-plus-migration`.

Current source includes public listing browse/detail/search/filtering, seller profiles and published seller storefronts, owner-scoped listing CRUD, review CRUD, Better Auth email/password authentication, account profile/preferences, saved homes, listing media upload/delete/reorder, and video-caption support. Source presence is not proof that every user flow has passed end-to-end verification or works in the current Netlify deployment.

## Implementation facts confirmed in the repository

- `src/app` contains Next.js pages, layouts, and Route Handlers.
- `src/db/schema.ts` defines application tables; `src/db/auth-schema.ts` defines Better Auth tables.
- Listing/application-table reads use Drizzle with `DRIZZLE_DATABASE_URL`.
- Owner-scoped writes use the separate app Drizzle client in `src/db/drizzle/app-client.ts`; write handlers set `app.current_user_id` transaction-locally from a verified Better Auth session.
- Better Auth uses the existing `public.users` table and `AUTH_DATABASE_URL`; `account`, `session`, and `verification` are separate auth tables.
- Supabase JS is used for Storage operations, not as the application-table query layer.
- The configured media policy is a private Supabase Storage bucket and server-issued signed URLs. Images include GIF; MP4/WebM are videos; WebVTT caption files are supported for video media. The tested/documented per-file media ceiling is 50,000,000 bytes.
- `APP_DATABASE_URL` is intended for the restricted `evergreen_app` login; `DIRECT_URL` is for Drizzle migrations only.
- `scripts/run-test-suite.mjs` owns test-suite categorization and descriptive terminal output. It sets `RUN_DB_INTEGRATION_TESTS=true` only for the explicitly selected database suites.
- `netlify.toml` defines `npm run build`, `.next` as the publish directory, and the Supabase image-host allowlist. This file alone does not prove a successful current Netlify build or correctly configured Netlify environment variables.
- No GitHub Actions quality workflow is configured on this branch. Do not reintroduce hosted CI unless requested.

## Database and migration status

The migration journal orders `0019_saved_listings_on_users.sql`, `0020_user_account_preferences.sql`, then `0021_reconcile_shared_read_role.sql`.

**Latest recorded live-check evidence, not freshly re-queried during this documentation change:**

- Migration 0019 was recorded as applied to the configured Supabase project; its column, 100-item constraint, owner policies, grants, and listing-delete cleanup trigger were checked through read-only catalog checks.
- Recorded verification from 2026-10-23 reports migration 0021 applied by Drizzle Kit. It also reports a successful full read-only population preflight after the migration, including role, grant, membership, RLS/policy, fixture, and Storage checks.
- Since migration 0021 revokes access to `users.preferences`, a column introduced by migration 0020, that recorded successful migration chain is consistent with 0020 also having run. Verify the migration ledger and effective privileges against the exact Supabase project intended for Netlify before relying on this historical evidence.
- No synthetic user/database/Storage population writes were run in the recorded dry-run.
- The historical checksum/provenance mismatch for migration 0011 remains unresolved. The forward-only migration 0021 reasserts the expected shared-read contract; it does not resolve the old checksum. Never edit migration 0011 or rewrite its existing Drizzle ledger row to force the hashes to match.

The fixture population script is deliberately pinned in source to Supabase project ref `vcsotaclvwvbpqiljkuk`. A dry-run is read-only. Apply mode requires explicit `--apply --confirm-project vcsotaclvwvbpqiljkuk`, a successful preflight, and private local `seed/credentials`. Do not run it during a build/deploy or against another project without intentionally changing and reviewing the script's target guard.

## Environment and release boundaries

`.env.example` is the source of truth for variable names. Keep real values out of git and client bundles. The production runtime normally needs the public Supabase URL/key, the three restricted runtime database URLs, Better Auth URL/secret, Resend key/from address, and server-only Supabase Storage key. `DIRECT_URL` belongs in a controlled migration environment, not in application requests.

Before treating the public Netlify demo as release-ready, verify the current site environment variables, deployment URL/custom-domain values, Resend sender/domain verification, authentication email links, media upload and signed-URL behavior, owner checks, and responsive/keyboard flows. A documentation edit cannot establish these live conditions.

## Immediate next work

1. Run the current branch's `vp check`, `vp test`, and `vp run test:all` as appropriate; the full suite requires `DRIZZLE_DATABASE_URL` for read-only integration tests. Run `npm run build` as well. Record actual command results rather than assuming prior checks cover later edits.
2. Connect/verify the Netlify site against this branch, set its runtime environment variables, and use a Deploy Preview before changing the public production site.
3. On the preview, test sign-up and verification email, sign-in/sign-out, password reset, seller profile publish/unpublish, listing CRUD/ownership, reviews, saved homes, image/GIF/video/caption upload and deletion, and privacy of account data.
4. Compare the working UI with the linked Figma design; no pixel-level comparison was completed as part of this documentation update.
5. Only after those gates are recorded should documentation status be changed from “not verified” to “verified”.

## Working style and safety

Keep implementation changes focused and explain the reason for non-obvious changes. Inspect relevant source, migration, and tests before changing behavior. Do not imply that source existence, passing unit tests, prior database checks, or a Netlify configuration file proves the complete production workflow is healthy. Preserve unrelated/non-fixture records and Storage objects.
