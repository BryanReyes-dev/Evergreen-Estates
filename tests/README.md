# Evergreen Estates tests

The test suite is run with the Vite+ CLI. Test APIs come from `vite-plus/test`; the Vite+ test reporter prints each test case to the terminal. The tests run in Node, not in a browser, and test files should not use browser-console output.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `vp test` | Run the discovered tests with the database integration suite safely skipped by default. |
| `vp test run tests/api/listings/media-order.test.ts` | Run one test file directly. |
| `vp run test:all` | Run unit, API, and read-only PostgreSQL integration tests. Requires `.env` with `DRIZZLE_DATABASE_URL`. |
| `vp run test:fast` | Run unit and isolated API tests without connecting to a database. |
| `vp run test:unit` | Run pure unit tests. |
| `vp run test:api` | Run mocked HTTP route tests. |
| `vp run test:integration` | Explicitly enable the read-only PostgreSQL integration suite. |
| `vp run test:seed-data` | Validate fixture relationships, counts, timestamps, and listing media files. |
| `vp run test:listing-collection` | Test public listing search and listing-creation guards. |
| `vp run test:listing-item` | Test listing detail reads and owner-scoped update/delete guards. |
| `vp run test:listing-media` | Test media reorder validation, exact permutations, and stale-write conflicts. |
| `vp run test:reviews` | Test review creation and author-scoped edit/delete validation. |
| `vp run test:seller-profiles` | Test seller-profile authentication and contact field validation. |
| `vp run test:saved-listings` | Test private saved-home authorization and request validation. |
| `vp run test:account-profile` | Test account preference validation. |
| `vp run test:media-upload` | Test listing-media upload URL and completion guards. |
| `vp run test:media-delete` | Test listing-media deletion authorization and Storage/database cleanup ordering. |
| `vp run test:avatar` | Test avatar multipart input and image signature validation. |
| `vp run test:db-permissions` | Run the read-only database role permission contract. |

Use `vp test watch tests/api/listings/media-order.test.ts` for watch mode on an individual test file.

## Boundaries

- `tests/unit/` contains deterministic tests that require no services.
- `tests/api/` contains route tests with mocked authentication, database, and Storage dependencies.
- `tests/integration/database/` contains an opt-in, read-only PostgreSQL privilege contract.

The suite runner sets `RUN_DB_INTEGRATION_TESTS=true` only for the integration and full-suite commands. The database integration file reads database credentials from the repository's local `.env` only after explicit opt-in. Its assertions use SELECT and privilege-inspection functions; it does not insert, update, delete, or change Storage objects.
