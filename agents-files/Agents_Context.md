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

Evergreen Estates is a Next.js 16 App Router property marketplace. Vite+ is the development check/test workflow; it does not replace Next.js as the app runtime. The current default branch is `main`; recent media playback, autoplay, navigation responsiveness, and media-sizing fixes were committed there.

Current source includes public listing browse/detail/search/filtering, seller profiles and published seller storefronts, owner-scoped listing CRUD, review CRUD, Better Auth email/password authentication, account profile/preferences, saved homes, listing media upload/delete/reorder, and video-caption support. Source presence is not proof that every user flow has passed end-to-end verification or works in the current Netlify deployment.

## Implementation facts confirmed in the repository

- `src/app` contains Next.js pages, layouts, and Route Handlers.
- `src/db/schema.ts` defines application tables; `src/db/auth-schema.ts` defines Better Auth tables.
- Listing/application-table reads use Drizzle with `DRIZZLE_DATABASE_URL`.
- Owner-scoped writes use the separate app Drizzle client in `src/db/drizzle/app-client.ts`; write handlers set `app.current_user_id` transaction-locally from a verified Better Auth session.
- Better Auth uses the existing `public.users` table and `AUTH_DATABASE_URL`; `account`, `session`, and `verification` are separate auth tables.
- Optional demo auth bypass is controlled by `ENABLE_DEMO_AUTH_BYPASS=true` (disabled by default); new demo accounts expire at their original creation time plus 24 hours. Migration `0022_demo_account_retention.sql` and the Netlify scheduled cleanup function must be configured before enabling it.
- Supabase JS is used for Storage operations, not as the application-table query layer.
- The configured media policy is a private Supabase Storage bucket and server-issued signed URLs. Images include GIF; MP4/WebM are videos; WebVTT caption files are supported for video media. The tested/documented per-file media ceiling is 50,000,000 bytes.
- `APP_DATABASE_URL` is intended for the restricted `evergreen_app` login; `DIRECT_URL` is for Drizzle migrations only.
- `scripts/run-test-suite.mjs` owns test-suite categorization and descriptive terminal output. It sets `RUN_DB_INTEGRATION_TESTS=true` only for the explicitly selected database suites.
- `tests/unit/media-display.test.ts`, exposed as `npm run test:media-display`, covers signed/query-string GIF source detection and shared video-player markup with and without captions, including autoplay/muted/loop attributes. Its presence is confirmed in source; its command was not run during the previous documentation update.
- `tests/unit/demo-account-retention.test.ts` and `npm run test:demo-retention` cover auth bypass configuration, 24-hour retention and cleanup orchestration; the command has not yet been run for this change.
- `netlify.toml` defines `npm run build`, `.next` as the publish directory, and the Supabase image-host allowlist. This file alone does not prove a successful current Netlify build or correctly configured Netlify environment variables.
- No GitHub Actions quality workflow is configured on this branch. Do not reintroduce hosted CI unless requested.

## Database and migration status

The migration journal orders `0019_saved_listings_on_users.sql`, `0020_user_account_preferences.sql`, `0021_reconcile_shared_read_role.sql`, `0022_demo_account_retention.sql`, `0023_restricted_demo_account_lookup.sql`, and `0024_exclude_seed_accounts_from_demo_cleanup.sql`.

**Latest recorded live-check evidence, not freshly re-queried during this documentation change:**

- Migration 0019 was recorded as applied to the configured Supabase project; its column, 100-item constraint, owner policies, grants, and listing-delete cleanup trigger were checked through read-only catalog checks.
- Recorded verification from 2026-10-23 reports migration 0021 applied by Drizzle Kit. It also reports a successful full read-only population preflight after the migration, including role, grant, membership, RLS/policy, fixture, and Storage checks.
- Since migration 0021 revokes access to `users.preferences`, a column introduced by migration 0020, that recorded successful migration chain is consistent with 0020 also having run. Verify the migration ledger and effective privileges against the exact Supabase project intended for Netlify before relying on this historical evidence.
- No synthetic user/database/Storage population writes were run in the recorded dry-run.
- Migration `0022_demo_account_retention.sql` and `0023_restricted_demo_account_lookup.sql` were applied to Supabase project `vcsotaclvwvbpqiljkuk` on 2026-10-25. Live checks confirmed the expiry marker and restricted cleanup routines. The user then ran `vp exec drizzle-kit migrate` and reported `migrations applied successfully`. Netlify's manual cleanup run returned `found=0 deleted=0 skipped=0 failed=0`; this confirms successful execution when no accounts were eligible, not real deletion.
- Migration `0024_exclude_seed_accounts_from_demo_cleanup.sql` is now committed but still needs to be applied to the target database. It protects the canonical seed identities `daniel.carter@example.com`, `maya.thompson@example.com`, `jordan.lee@example.com`, and `priya.patel@example.com` from both candidate lookup and final deletion even if an expiry marker is set. Apply it with `vp exec drizzle-kit migrate` after pulling the latest `main`. Keep `ENABLE_DEMO_AUTH_BYPASS=false` until this migration is applied and disposable-account deletion is tested.

The fixture population script is deliberately pinned in source to Supabase project ref `vcsotaclvwvbpqiljkuk`. A dry-run is read-only. Apply mode requires explicit `--apply --confirm-project vcsotaclvwvbpqiljkuk`, a successful preflight, and private local `seed/credentials`. Do not run it during a build/deploy or against another project without intentionally changing and reviewing the script's target guard.

## Environment and release boundaries

`.env.example` is the source of truth for variable names. Keep real values out of git and client bundles. The production runtime normally needs the public Supabase URL/key, the three restricted runtime database URLs, Better Auth URL/secret, Resend key/from address, and server-only Supabase Storage key. `DIRECT_URL` belongs in a controlled migration environment, not in application requests.

Before treating the public Netlify demo as release-ready, verify the current site environment variables, deployment URL/custom-domain values, Resend sender/domain verification, authentication email links, media upload and signed-URL behavior, owner checks, and responsive/keyboard flows. A documentation edit cannot establish these live conditions.

## Immediate next work

1. Pull latest `main` and run `vp exec drizzle-kit migrate` with the intended `DIRECT_URL` to apply migration 0024's seed-account exclusion. Do not edit the Drizzle ledger manually.
2. Run `npm run test:demo-retention`, `vp check`, relevant unit/API tests, and `npm run build`; record actual output.
3. Keep `ENABLE_DEMO_AUTH_BYPASS=false` until migration 0024 is applied and disposable-account deletion is verified end-to-end.
4. In Netlify, verify the latest published deploy and scheduled function. Create a disposable demo account/listing/media, expire only that account for testing, run cleanup, and verify database and Storage deletion. Netlify Scheduled Functions run automatically only on published deploys, not Deploy Previews.
5. Compare the working UI with the linked Figma design; no pixel-level comparison was completed as part of this work.

## Working style and safety

Keep implementation changes focused and explain the reason for non-obvious changes. Inspect relevant source, migration, and tests before changing behavior. Do not imply that source existence, passing unit tests, prior database checks, or a Netlify configuration file proves the complete production workflow is healthy. Preserve unrelated/non-fixture records and Storage objects.
