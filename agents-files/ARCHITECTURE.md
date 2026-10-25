# Evergreen Estates — Architecture

## Document authority and status

This is the durable architecture record. It documents what the repository implements and the constraints new work must preserve; it is not a specification that silently promotes proposed work to implemented status.

- [Agents_Context.md](./Agents_Context.md) contains current work status and time-sensitive verification evidence.
- [AGENTS.md](./AGENTS.md) contains coding-agent rules.
- [CLAUDE.md](./CLAUDE.md) is the Claude Code entry point.
- [../README.md](../README.md) is the human-facing project guide.

Last documentation review: 2026-10-25. Live database and Netlify checks below are explicitly dated/qualified; this document update did not connect to either service.

## 1. Product and technology stack

Evergreen Estates is a real-estate marketplace built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui, Base UI, Framer Motion, Embla Carousel, and Hugeicons. The application uses PostgreSQL hosted by Supabase, Drizzle ORM/Drizzle Kit, Better Auth, and Supabase Storage. Resend delivers authentication email. Vite+ supplies local static-check and test tooling; Next.js remains the web application framework/runtime.

Implemented source includes:

- Public listing browse/detail, server-side search and URL-driven filters.
- Seller profile create/edit/delete flows, published seller storefronts, and owner-scoped listing CRUD.
- Review read/create/edit/delete flows.
- Better Auth email/password authentication against the canonical `public.users` table.
- Account profile and browsing preferences, saved homes, listing media management, and video-caption upload support.
- A guarded developer-run population/preflight script. It is not an application-startup or deployment-build task.

These are source-level capabilities. Automated test coverage and complete UI, browser, production-email, and deployment behavior must be described from actual test results, not inferred from route or component presence.

## 2. Application structure and request boundaries

Important directories:

- `src/app/` — pages, layouts, and Next.js Route Handlers.
- `src/components/` — shared and feature UI, including client-side interactive components.
- `src/db/` — Drizzle schemas, queries, database clients, seed fixtures, and Storage helpers.
- `src/lib/` — shared utilities, API auth checks, Better Auth setup, and Netlify image loader.
- `tests/unit/`, `tests/api/`, `tests/integration/` — isolated unit tests, mocked Route Handler tests, and opt-in read-only database permission tests.
- `drizzle/` — versioned SQL migrations and Drizzle migration metadata.
- `scripts/` — test-suite runner and guarded population tool.
- `seed/images/` — source fixture media; `seed/credentials` is local-only and gitignored.

Server Components are the default for page data fetching/rendering. Client Components are reserved for browser-side state/events, navigation, animation, filtering controls, and carousel interactions.

Explicit HTTP endpoints are implemented as Next.js Route Handlers. Better Auth is mounted at `/api/auth/[...all]`. Versioned API handlers cover listing collection/item operations, seller profiles, reviews, media upload/completion/deletion, account profile/avatar operations, and `/api/v1/users/me/saved-listings`. Inspect the route files for exact methods and paths before adding endpoints. A client-side check is never authorization: every protected mutation must verify the server-side session, validate fields, bind ownership to the authenticated user, and return safe JSON errors.

Listing read/query logic uses Drizzle. Current mutation statements are issued in Route Handlers through the shared `withAppUserTransaction` helper; a separate mutation-service layer is not assumed to exist. Do not replace application-table Drizzle queries with Supabase JS calls.

## 3. Database clients and security boundaries

Database URLs are deliberately separate:

| Variable | Role/connection | Responsibility |
|---|---|---|
| `DRIZZLE_DATABASE_URL` | `evergreen_runtime` | Read-only application-table reads |
| `AUTH_DATABASE_URL` | `evergreen_auth` | Better Auth user/account/session/verification work |
| `APP_DATABASE_URL` | `evergreen_app` | Owner-scoped application writes |
| `DIRECT_URL` | Privileged migration connection | Drizzle Kit migrations only |

Use the Supabase shared transaction pooler for server runtime connections when configured for the role (commonly port 6543); disable prepared statements for pooler compatibility as the clients currently do. Never use `DIRECT_URL` in a request handler. Never use a privileged `postgres`/admin credential as the runtime read or app-write connection. Keep all database URLs, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `SUPABASE_SECRET_KEY` server-side.

The app client in `src/db/drizzle/app-client.ts` wraps writes with a transaction-local `app.current_user_id` set from the verified Better Auth session. It must not accept a request-body user ID as the authority for the transaction. Grants and row-level security policies remain required in addition to application checks.

### Shared read role

`evergreen_read` is a NOLOGIN role holding shared read privileges and targeted by shared-read RLS policies. `evergreen_runtime` and `evergreen_app` inherit its allowed reads with `INHERIT TRUE, SET FALSE`. The runtime role must remain read-only; `evergreen_auth` should not be granted broad application-table access. Shared public identity access is limited to `users.id`, `users.name`, and `users.image`; login email, saved homes, preferences, auth verification state, and session/token data are not public identity fields.

`evergreen_app` permissions are intended to be narrow and owner-scoped. On `public.users`, its read/write access to private fields is constrained by policies that use `app.current_user_id`. Do not broaden runtime/auth permissions to work around a missing app write grant. Review the migrations and test effective privileges against the target database before making a privilege claim.

## 4. Data model and schema evolution

The application schema is in `src/db/schema.ts`; Better Auth-specific table definitions are in `src/db/auth-schema.ts`.

- `users` is the canonical Better Auth user identity table, with UUID `id`, unique email, public `name`/optional `image`, private `saved_listings`, and private JSONB `preferences`.
- `preferences` stores supported browse defaults: `defaultSort` (`newest`, `price-low`, `price-high`) and `viewMode` (`grid`, `list`).
- `saved_listings` stores listing UUIDs and is capped at 100 by a database constraint and API validation. Removing a listing runs a database trigger that removes its ID from saved arrays.
- `seller_profiles.user_id` is the user identity key. Public storefront reads are constrained to published profiles. Seller login email is not automatically exposed as public contact information; only intentionally entered profile contact fields are displayed.
- Listings and reviews have owner/author boundaries enforced by server checks and PostgreSQL grants/RLS policies.
- Better Auth owns `account`, `session`, and `verification` tables, separate from application profile data.

### Migration history and known exception

The migration journal orders the relevant current migrations as:

1. `0019_saved_listings_on_users.sql` — saved-home array, 100-ID limit, owner-scoped policies/grants, and cleanup trigger.
2. `0020_user_account_preferences.sql` — private preference column and constraint, avatar/read grants, and one-time legacy avatar backfill from already-published seller profiles.
3. `0021_reconcile_shared_read_role.sql` — forward-only reassertion of the shared-read role's grants, memberships, and RLS policies.

Recorded verification from 2026-10-23 reports 0019 applied and validated with read-only catalog checks; it reports 0021 applied through Drizzle Kit and the population preflight passing afterward. A successful run of 0021 is consistent with 0020 having been applied first because 0021 explicitly references `users.preferences`. This documentation update did not query the live database. Re-run migration/privilege preflight against the exact Supabase project chosen for the Netlify deployment before relying on the recorded status.

The byte-level provenance/checksum discrepancy for historical migration `0011_shared_read_role.sql` is intentionally unresolved. The tracked SQL hash is `5f654419803188a68ae069c3a3d873821cdae57c9a58c9ecd5b7bae44a8f9af4`; the existing Drizzle ledger records `d23ee45dadfe79d8ff2346b80fc07872a1c7edebd4b88bc511a83a944ea6baed`. Forward-only migration 0021 reasserts the intended live role/grant/policy contract and leaves old history alone. Do not edit migration 0011 or rewrite its ledger row to force the checksum to match.

## 5. Authentication and account security

Better Auth email/password authentication maps its user model to `public.users`. Its database adapter uses `AUTH_DATABASE_URL`, not the read-only runtime client or privileged migration URL. Normal mode requires email verification; verification links and password-reset links expire after one hour, password reset revokes existing sessions, and custom rate limits cover sign-in, sign-up, verification requests, and reset requests.

The opt-in `ENABLE_DEMO_AUTH_BYPASS=true` mode disables verification only for deliberate development/demo testing, auto-signs-in new accounts, and stamps `users.demo_expires_at` at `created_at + 24 hours`. It is disabled by default. Migration `0022_demo_account_retention.sql` grants only `evergreen_auth` execution of the private `private.delete_expired_demo_account(uuid)` routine, which rechecks expiry before deleting rows. A Netlify Scheduled Function runs every 15 minutes, purges media folders before invoking database deletion, and processes up to five accounts per run. It uses `AUTH_DATABASE_URL`, `APP_DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SECRET_KEY`; it must not use `DIRECT_URL` at runtime. Keep the flag disabled for production-ready deployments and apply the migration before enabling it.

`src/lib/auth-email.ts` sends email through Resend with `RESEND_API_KEY` and `AUTH_EMAIL_FROM`. Missing configuration or provider failure prevents delivery; handlers avoid logging verification/reset tokens and recipient details. Production setup must set the correct `BETTER_AUTH_URL`, provision a strong `BETTER_AUTH_SECRET`, verify the Resend sender domain/address, and test the real email links against the deployed domain.

Authentication credentials, sessions, token tables, account preferences, and saved-home arrays are private. API handlers must not leak these fields through public responses.

## 6. Media and image delivery

Listing media is stored in the configured private Supabase Storage bucket. Application media records identify files; the server resolves signed URLs for display and uses privileged server-side Storage helpers only where required. Do not make the bucket public merely to simplify delivery.

Current media constraints:

- Supported image formats include JPG/JPEG, PNG, WebP, AVIF, and GIF. GIF remains in the `image` category.
- MP4 and WebM are `video` media and render with native video controls.
- WebVTT caption files are supported for video-caption uploads.
- The documented and tested per-file size limit is decimal 50,000,000 bytes.
- Filename validation and path-traversal defenses are applied before Storage operations.
- Upload, completion, caption upload, reorder, and delete operations must enforce authentication, ownership, and database registration checks.

`src/lib/netlifyImageLoader.ts` creates `/.netlify/images` URLs for production. `next.config.ts` disables Next Image optimization in development and allowlists the configured Supabase Storage host. `netlify.toml` declares `npm run build`, `.next`, and the remote-image host. The configuration should be validated using a Netlify Deploy Preview; a checked-in TOML file alone is not evidence of a successful deployment or live image optimization.

## 7. Testing and developer tooling

Vite+ is used for local checks and tests. The current `vite.config.ts` configures Node-based verbose tests under `tests/**/*.test.ts`, with mocked API tests isolated from external services. `scripts/run-test-suite.mjs` prints a suite description and runs focused paths. Only the explicitly selected integration suites enable `RUN_DB_INTEGRATION_TESTS=true`.

Useful commands:

- `vp check` — configured formatting, lint, and type/static checks.
- `vp check --no-fmt` — check without the format stage.
- `vp test` — default tests; database integration remains opt-in.
- `vp run test:fast`, `vp run test:unit`, `vp run test:api` — isolated tests without database connections.
- `vp run test:integration` or `vp run test:db-permissions` — opt-in read-only PostgreSQL permission checks requiring `DRIZZLE_DATABASE_URL` as `evergreen_runtime`.
- `vp run test:all` — unit, mocked API, and read-only database permission suite.
- `npm run test:media-display` — focused GIF source URL detection and shared video-player rendering tests, including playback markup when captions are absent or present and muted autoplay/loop attributes.
- `npm run test:demo-retention` — demo-mode auth configuration, 24-hour expiry, and cleanup ordering/failure isolation tests.

The demo-retention suite tests cleanup orchestration with mocked dependencies; it does not prove that the migration has been applied or that the live Netlify scheduler/Storage permissions work. The media-display suite checks source/rendered markup; it does not by itself prove that browser autoplay policies allow playback on every device. Do not claim these commands passed unless the result was observed for the relevant current code. The full suite does not replace browser-level, email-provider, and Netlify runtime verification. GitHub Actions is not configured on this branch, so do not assume a remote CI gate ran.

## 8. Fixture population and project safety

`npm run populate:dry-run` runs a read-only preflight. The script validates its pinned project reference (`vcsotaclvwvbpqiljkuk`), database-role/grant/RLS contracts, fixture relationships, listing cap, local media manifest, and existing private Storage objects. The latest recorded dry-run planned 4 synthetic sellers, 4 seller profiles, 12 listings, 48 reviews, and 48 media objects; at the time, 14 existing objects matched byte-for-byte and 34 were missing. Those counts describe that historical dry-run only and can change as the project changes.

Apply mode provisions synthetic auth accounts/rows and uploads missing fixture media, but must not delete unrelated records or objects. It requires explicit `--apply --confirm-project vcsotaclvwvbpqiljkuk`, a clean live preflight, and `seed/credentials` with unique local passwords. `seed/credentials` is gitignored. Never run population automatically at app startup or in Netlify's build command.

## 9. Production readiness and explicit non-goals

Before public release, verify the current Netlify site's build, variables, preview and production URL values, Resend domain/sender and auth email flow, signed media URLs/uploads, account privacy, listing ownership, and mobile/keyboard behavior. Compare the UI to the Figma source before claiming pixel alignment. These are release gates, not proven facts from repository configuration.

The population script is currently project-pinned, the migration 0011 hash discrepancy remains a known historical exception, and no full end-to-end test or deployment success is implied here. Future work must preserve the current least-privilege role boundaries, private media storage, canonical user identity, and forward-only migration discipline.
