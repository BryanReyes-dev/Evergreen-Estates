# Evergreen Estates test guide

Vite+ (`vp`) is the test runner. Tests use APIs from `vite-plus/test`, run in Node, and print individual test cases through the verbose reporter. This guide documents the all-tests command, suite categories, focused aliases, exact test paths, and the boundaries of the current coverage.

## Recommended command: run all tests

From the repository root, run this single command before a PR or substantial change:

```sh
vp run test:all
```

It runs every discovered test file matching `tests/**/*.test.ts`: deterministic unit tests, mocked HTTP Route Handler tests, and the read-only PostgreSQL permission integration suite. The runner sets `RUN_DB_INTEGRATION_TESTS=true` for this command, so the database integration checks are included rather than silently skipped.

The full suite requires `DRIZZLE_DATABASE_URL` in the local `.env` file, using the restricted `evergreen_runtime` database role. These integration tests only perform reads and privilege inspections; they do not insert, update, or delete rows or modify Storage objects. Still verify that the URL targets the intended test/project database before running.

## Suite categories

| Command | Files included | What it does |
|---|---|---|
| `vp run test:all` | All `tests/**/*.test.ts` files | Complete current suite: unit, API, and read-only database permission tests. Enables database integration explicitly. |
| `vp run test:fast` | `tests/unit/`, `tests/api/` | Fast isolated unit and mocked API tests. Does not enable or connect to the database integration suite. |
| `vp run test:unit` | `tests/unit/` | Deterministic unit tests for pure helpers, auth configuration/messages, fixture checks, preferences, media rules/display, and demo-retention logic. |
| `vp run test:api` | `tests/api/` | HTTP Route Handler tests with authentication, database, and Storage dependencies mocked. Exercises validation, ownership and authorization rules without a live database. |
| `vp run test:filters` | Filter URL helper tests and listing-search API tests | Verifies tag accumulation/removal, preserving query/price/sort state, clearing filters, and repeated supported tags in API parsing. |
| `vp run test:integration` | `tests/integration/` | Read-only PostgreSQL role-permission checks. Enables opt-in integration tests; requires the restricted runtime database connection. |

### Direct Vite+ commands

- `vp test` runs test discovery directly but leaves the opt-in database integration suite disabled by default. It is **not** the canonical complete-suite command.
- `vp test run tests/unit/media-display.test.ts` runs one isolated test file directly.
- `vp test watch tests/api/listings/media-order.test.ts` watches a specific file during development.

For database integration tests, use `vp run test:integration` or `vp run test:db-permissions`, not a direct-file invocation that omits the suite runner's environment setup.

## Focused suite inventory

Every focused alias below is defined in `package.json` and mapped in `scripts/run-test-suite.mjs`.

| Command | Test file(s) | What it verifies |
|---|---|---|
| `vp run test:seed-data` | `tests/unit/seed-data.test.ts` | Seed fixture counts and relationships, timestamps, contact values, and local listing-media manifest integrity. |
| `vp run test:account-preferences` | `tests/unit/account-preferences.test.ts` | Default listing sort/layout and strict validation of supported preference values. |
| `vp run test:auth-config` | `tests/unit/auth-configuration.test.ts`; `tests/unit/auth-error-messages.test.ts` | Authentication configuration, signup error messaging, email-verification/token lifetime, password-reset session revocation, and rate limits. |
| `vp run test:fixture-auth` | `tests/unit/fixture-auth-allowlist.test.ts` | Ensures only exact synthetic fixture email/name pairs pass the seed-only identity allowlist. |
| `vp run test:media-limits` | `tests/unit/media-file-limits.test.ts` | The documented decimal 50,000,000-byte per-file listing-media limit. |
| `vp run test:media-filenames` | `tests/unit/media-filename-allowlist.test.ts` | Supported image/video extensions, filename length limits, and path-traversal protection. |
| `vp run test:filters` | `tests/unit/listing-filter-params.test.ts`; `tests/api/listings/listings-collection.test.ts` | Multi-tag URL composition and repeated supported tag handling at the listing-search API boundary. |
| `vp run test:listing-collection` | `tests/api/listings/listings-collection.test.ts` | Public listing-search parsing and listing-creation authentication, validation, seller eligibility, and owner binding. |
| `vp run test:listing-item` | `tests/api/listings/listing-item.test.ts` | Listing detail Route Handler behavior and owner-scoped update/delete validation. |
| `vp run test:listing-media` | `tests/api/listings/media-order.test.ts` | Listing media ordering, reorder/permutation validation, and stale-write conflict behavior. |
| `vp run test:reviews` | `tests/api/reviews/review-routes.test.ts` | Review collection/item authentication, rating/comment validation, and author-scoped create/edit/delete rules. |
| `vp run test:seller-profiles` | `tests/api/seller-profiles/seller-profiles.test.ts` | Seller-profile enrollment/updates, contact fields, authentication, and protection against unsupported fields. |
| `vp run test:saved-listings` | `tests/api/account/saved-listings.test.ts` | Private saved-home reads/writes, user-ID protection, listing UUID validation, and save-state validation. |
| `vp run test:account-profile` | `tests/api/account/profile-preferences.test.ts` | Account-settings API authentication, preference shape, supported sort/layout values, and avatar URL handling. |
| `vp run test:media-upload` | `tests/api/media/upload-validation.test.ts` | Listing-media upload URL/completion input validation and authorization before privileged Storage/database operations. |
| `vp run test:media-delete` | `tests/api/media/delete-media.test.ts` | Listing-media deletion authentication/ownership, registration checks, and Storage/database cleanup ordering. |
| `vp run test:media-captions` | `tests/unit/media-captions.test.ts`; `tests/api/media/caption-upload.test.ts` | WebVTT caption validation, authenticated caption uploads, and owner/registration checks for listing videos. |
| `vp run test:media-display` | `tests/unit/media-display.test.ts` | GIF source URL detection and rendered video-player markup with/without captions, including muted autoplay/loop attributes. The test checks server-rendered markup; it does not exercise real browser playback. |
| `vp run test:demo-retention` | `tests/unit/auth-configuration.test.ts`; `tests/unit/demo-account-retention.test.ts` | Demo-mode verification bypass, 24-hour retention, storage-before-database cleanup ordering, cleanup failure isolation/concurrency guard, and skip-button messaging. |
| `vp run test:avatar` | `tests/api/account/avatar.test.ts` | Avatar upload authentication, multipart input handling, and actual image-signature validation. |
| `vp run test:db-permissions` | `tests/integration/database/runtime-permissions.test.ts` | Read-only contract for the `evergreen_runtime` role: permitted reads and denied writes/private access. Enables the database integration flag. |

The focused aliases are convenient subsets. A focused alias may overlap a broader alias (for example, `test:demo-retention` includes auth configuration tests also covered by `test:auth-config`). To guarantee that the current full collection is run, use `vp run test:all`.

## Boundaries and complementary checks

- `tests/unit/` contains deterministic tests and should not require live services.
- `tests/api/` uses mocked dependencies for HTTP Route Handler input, authentication, ownership, and authorization behavior.
- `tests/integration/database/` contains an opt-in, read-only PostgreSQL privilege contract.
- The tests are Node-based; this suite does not currently constitute a browser end-to-end suite. It does not confirm real browser media playback, a complete production user journey, email deliverability, or deployment health.
- `vp run test:all` does not replace `vp check` (formatting/lint/static checks) or `vp run build`. Run those separately when preparing a release.

The suite runner prints each selected suite's description and test paths to the terminal. Its `all` selection targets the complete `tests/` directory and enables the opt-in database suite; when a new test file is added under `tests/**/*.test.ts`, it is automatically included by the all-tests command.
