<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework-sensitive code. In monorepos, resolve the installed Next.js package from the applicable app directory. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Evergreen Estates — Agent Instructions

Evergreen Estates is a Next.js App Router real-estate marketplace with Drizzle/PostgreSQL, Better Auth, private Supabase Storage, and Vite+ local checks/tests. Next.js remains the application runtime; Vite+ is developer tooling.

## Required reading order

1. Read [Agents_Context.md](./Agents_Context.md) for current status, verified evidence, and immediate work.
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for long-lived architecture and security boundaries.
3. Read the human-facing [README](../README.md) for install, environment, test, and deployment commands.
4. Read the installed Next.js guide under `node_modules/next/dist/docs/` before changing framework-sensitive behavior.
5. Inspect relevant source files, SQL migrations, and tests before editing.

## Safe workflow

- Check the actual branch, working-tree status, latest commit, and existing local changes before proposing or applying changes.
- Keep changes scoped to the requested goal. Explain consequential architecture, data, permission, or destructive changes.
- Do not claim that a change is tested, deployed, or live-verified unless the result was actually observed. Distinguish source implementation, test evidence, historical recorded evidence, and pending verification.
- Run the Vite+ checks and relevant tests for code changes, then a production build when applicable. Record commands/results accurately.
- The current branch does not configure GitHub Actions quality checks. Do not recreate hosted CI unless explicitly requested.
- Do not silently broaden the task, rewrite unrelated files, add a separate framework/server, or move Next.js to another runtime.

## Architecture and API constraints

- Use Next.js App Router Route Handlers for the explicit HTTP API. Better Auth is mounted at `/api/auth/[...all]`; versioned application APIs live under `src/app/api/v1`.
- Keep application-table query paths on Drizzle. Supabase JS is a Storage helper, not a replacement for the PostgreSQL query layer.
- Keep Server Components as the default. Use Client Components when browser APIs, state/event handlers, animated or interactive controls, or carousel behavior require them.
- Every protected mutation must authenticate on the server, validate the allowed body fields, derive the owner from the verified Better Auth session, enforce ownership/business constraints, and return client-safe errors.
- Never trust an owner/user ID supplied by a request body. App-write SQL must use the shared `withAppUserTransaction` helper so `app.current_user_id` is set transaction-locally from the verified user ID.
- Preserve the distinct connection boundary: `DRIZZLE_DATABASE_URL` = read-only `evergreen_runtime`; `AUTH_DATABASE_URL` = `evergreen_auth`; `APP_DATABASE_URL` = owner-scoped `evergreen_app`; `DIRECT_URL` = privileged migrations only.
- Keep auth data, saved homes, and account preferences private. Public user identity reads are limited to ID, name, and avatar. Seller storefronts must only expose published profiles and intentionally supplied public contact details.
- Keep listing media in private Storage with signed URLs, maintain the existing filename/extension checks, keep GIF as an image, and preserve the decimal 50,000,000-byte file cap and video-caption validation.
- Preserve the 100-saved-home limit and the database cleanup trigger on listing deletion.

## Schema and data safety

- Use forward-only migrations for schema changes. Read the relevant SQL and migration journal before editing.
- Do not change `drizzle/0011_shared_read_role.sql` or rewrite its existing ledger row to force the historical checksum discrepancy to match. Migration 0021 is a forward-only reconciliation; the historical discrepancy remains.
- Do not grant broad application writes to `evergreen_runtime` or `evergreen_auth`. Verify live database grants/RLS against the target project before asserting deployment state.
- The population script is a developer utility, not app/build startup. It is pinned to project ref `vcsotaclvwvbpqiljkuk`. Dry-run first; apply mode requires explicit project confirmation and local `seed/credentials`. Never commit passwords, tokens, sessions, env secrets, or `seed/credentials`.
- Preserve unrelated/non-fixture database rows and Storage objects. Do not make the media bucket public to work around signed-URL issues.

## Vite+ testing commands

- `vp check` — checks.
- `vp check --no-fmt` — checks without formatting.
- `vp test` — default test run; database integration is opt-in.
- `vp run test:fast`, `vp run test:unit`, `vp run test:api` — isolated test suites.
- `vp run test:integration` or `vp run test:db-permissions` — read-only database permissions; requires `DRIZZLE_DATABASE_URL` for `evergreen_runtime`.
- `vp run test:all` — full unit, mocked API, and read-only permission suite.
- Focused `test:*` aliases are declared in `package.json` and documented in the README. Prefer the narrowest useful suite while iterating and run the broader checks before release.

## Documentation rules

- `../README.md` is for humans; this file is for agent behavior.
- `Agents_Context.md` is short-lived and should be refreshed when current task/verification status changes.
- `ARCHITECTURE.md` is the only durable architecture authority.
- `CLAUDE.md` is a small Claude Code import entry point.
- Do not recreate the deleted implementation handoff; incorporate lasting findings into the architecture or short-term context instead.
- Treat design alignment with Figma and Netlify build/runtime health as unverified until inspected/tested.
