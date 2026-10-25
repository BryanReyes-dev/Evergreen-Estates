# EverGreen Estates

## Overview

EverGreen Estates is a full-stack real estate web application built with Next.js, TypeScript, Supabase, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

The project uses the Next.js App Router, Server Components for data fetching and rendering, and focused Client Components for browser interactivity. Users can browse property listings, view property details, search listings, and filter properties through URL-based search parameters connected to server-side Drizzle ORM queries against PostgreSQL.

## Live Demo Link

[Visit site](https://evergreen-estates.netlify.app/)

![Evergreen Estates Homepage](./dev-images/Screenshot%202026-06-28%20134531.png)

![Async UI State Pattern (Loading, Error, Empty, Success)](./dev-images/Screenshot%202026-06-28%20132230.png)

## Features

- Responsive mobile-first design
- Property browsing and listing pages
- Property media galleries using Supabase Storage
- Two media categories: images and videos
- JPG, JPEG, PNG, WebP, AVIF, and GIF media use Next.js `<Image>`
- MP4 and WebM media use native `<video controls>`
- Server-side search and URL-driven filtering
- Shareable filtered URLs
- Featured property listings
- Loading, error, and data components
- Responsive component-based UI
- Seller storefront pages for profiles marked public
- Accessibility and SEO considerations
- Server-side data fetching with async Server Components
- Better Auth email/password authentication with a canonical `public.users` table
- Authenticated seller-profile creation, read, update, and deletion endpoints
- Authenticated listing create, update, and delete endpoints
- Review read, create, update, and delete endpoints
- Listing media upload-url, completion, and file-delete endpoints
- Saved-home GET/PATCH persistence for authenticated users
- Tailwind CSS and shadcn/ui styling

The current source includes email/password authentication, seller-profile management, published seller storefronts, listing create/edit/delete, saved-home add/remove and listing, review create/edit/delete, and listing media management. Source still requires TypeScript, lint, production build, automated tests, and manual end-to-end verification. Migration 0019_saved_listings_on_users.sql has been applied to the configured Supabase project and its schema, grants, policies, and trigger were checked; saved-home workflows are not yet browser-verified. The forward-only migration `0021_reconcile_shared_read_role.sql` has now been applied and recorded in the Drizzle ledger; its live role, grant, membership, policy, and RLS contracts pass the population preflight. The historical `0011` checksum discrepancy remains unresolved at the byte level (ledger hash `d23ee45d...` versus tracked SQL hash `5f654419...`), but has been explicitly reviewed and acknowledged for the fixture-population workflow. No historical migration or ledger row was edited.

## Media and Image Delivery

Listing media is stored in Supabase Storage and resolved to signed URLs by the server-side database layer.

The application intentionally keeps only two media categories:

```text
JPG / JPEG / PNG / WebP / AVIF / GIF → image
MP4 / WebM                           → video
```

GIF remains an image category and is rendered through Next.js `<Image>`.

Production uses a custom Next.js image loader at `src/lib/netlifyImageLoader.ts`. It generates Netlify Image CDN requests under `/.netlify/images`. The Supabase remote host is allowlisted in `netlify.toml` so Netlify can optimize those remote images.

Local development intentionally bypasses that Netlify-only optimization endpoint. `next.config.ts` sets `images.unoptimized` to `true` when `NODE_ENV` is `development`, so `npm run dev` loads the original Supabase image URL instead of requesting `/.netlify/images` from the local Next.js server.

This keeps development and production functional without introducing a second image service locally.

## Technologies Used

### Frontend

- Next.js 16.x (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Embla Carousel
- Hugeicons

### Backend / Database

- Drizzle ORM for server-side PostgreSQL queries
- Drizzle Kit for versioned schema migrations
- Supabase
  - PostgreSQL database and Row Level Security
  - Storage bucket for property media
  - Supabase JS client for Storage operations only

### Deployment

- Netlify
- Next.js Runtime
- Netlify Image CDN for production image optimization

### Development Tools

- Git
- GitHub
- VS Code
- ESLint
- npm

## Repository

[View Repository](https://github.com/BryanReyes-dev/evergreen-estates)

## Agent Files

The `agent-files/` directory contains documentation for AI coding agents. `AGENTS.md` contains agent operating instructions, `Agents_Context.md` stores short-term working context, and `CLAUDE.md` is the Claude entry point.

There is exactly one architecture document: `agent-files/ARCHITECTURE.md`. It is the authoritative record of finalized project architecture.

## Project Architecture

The application separates route/page composition, reusable UI, database access, and shared utilities. Listing read queries, schemas, Drizzle clients, and Storage helpers live under `src/db`. Current write Route Handlers issue Drizzle statements in the route files and use the shared transaction helper in `src/db/drizzle/app-client.ts`; dedicated mutation modules have not been extracted.

Server Components handle property-data fetching and rendering by default. Client Components are used for browser-specific behavior such as interactive filtering, navigation state, animation, and Embla carousel interaction.

Property filtering is URL-driven: filter controls update search parameters, Next.js renders the server-side result, and Drizzle ORM executes parameterized PostgreSQL queries. Supabase JS remains for Storage signed URLs.

For the complete finalized architecture, see `agent-files/ARCHITECTURE.md`.

## Installation Steps

Clone the repository:

```bash
git clone https://github.com/BryanReyes-dev/evergreen-estates.git
```

Navigate into the project:

```bash
cd evergreen-estates
```

Install dependencies:

```bash
npm install
```

Create environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
DIRECT_URL=
DRIZZLE_DATABASE_URL=
AUTH_DATABASE_URL=
APP_DATABASE_URL=
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=
```

`SUPABASE_SECRET_KEY` is server-only and is used by the Storage admin helper. `APP_DATABASE_URL` uses the restricted `evergreen_app` login for owner-scoped writes. Keep both, all database URLs, and `BETTER_AUTH_SECRET` out of client code and version control. See [agent-files/ARCHITECTURE.md](./agent-files/ARCHITECTURE.md) for the role boundaries and endpoint details.

### Configure the Drizzle runtime role

The Drizzle read path uses `DRIZZLE_DATABASE_URL` and must not use the privileged `postgres` migration connection. Pull the branch and apply the pending migration:

```bash
npx drizzle-kit migrate
```

Migration `0006` replaces the temporary `evergreen_readonly` group with a single, restricted `evergreen_runtime` login. The migration creates the login without a password so the credential is not committed to Git. After the migration succeeds, set its password separately in the Supabase SQL Editor (use a strong, unique password generated in a password manager):

```sql
ALTER ROLE evergreen_runtime WITH PASSWORD '<your-strong-password>';
```

In the Supabase Dashboard's **Connect** dialog, copy the **shared transaction pooler** connection details and configure `DRIZZLE_DATABASE_URL` with the role username format `evergreen_runtime.<project-ref>`, the password you just set, and the copied host/port. Port 6543 is transaction mode. URL-encode special characters in the password.

Keep `DIRECT_URL` restricted to Drizzle Kit migrations. Do not use `postgres` or `service_role` credentials for runtime reads, and never expose `DRIZZLE_DATABASE_URL` through a `NEXT_PUBLIC_` variable. The runtime role has read-only application-table permissions and cannot access the private Drizzle migration schema.

### Configure the Better Auth role

Migration `0008` creates a separate `evergreen_auth` login with access limited to the canonical `users` table and the Better Auth `account`, `session`, and `verification` tables. The migration intentionally creates this role without a password. After `npx drizzle-kit migrate` succeeds, set a strong password separately in the Supabase SQL Editor:

```sql
ALTER ROLE evergreen_auth WITH PASSWORD '<your-strong-password>';
```

Configure `AUTH_DATABASE_URL` with the Supabase shared transaction pooler details (port 6543), username `evergreen_auth.<project-ref>`, and that password. This connection is separate from the read-only `DRIZZLE_DATABASE_URL`. Never use `DIRECT_URL` for application requests or expose either database URL via a `NEXT_PUBLIC_` variable.

Set `BETTER_AUTH_URL=http://localhost:3000` locally and generate a strong `BETTER_AUTH_SECRET` (at least 32 characters). Keep the secret server-only and configure the production URL/secret in the deployment environment before enabling auth there.

### Configure the application-write role

The local schema and migrations define the restricted `evergreen_app` login. After applying migrations, set its password out of band in the Supabase SQL Editor:

```sql
ALTER ROLE evergreen_app WITH PASSWORD '<your-strong-password>';
```

Set `APP_DATABASE_URL` to the shared transaction pooler connection using username `evergreen_app.<project-ref>` and the generated password. The app client uses this connection only for owner-scoped writes; do not substitute the migration, read-only, or Better Auth database URL.

Run the development server:

```bash
npm run dev
```

Open the development URL reported by Next.js.

Build the application:

```bash
npm run build
```

Run the production build locally:

```bash
npm start
```

### Automated tests with Vite+

The automated suite uses Vite+'s built-in Vitest runner and the single `vite.config.ts` configuration. Tests run in the Node environment and use verbose reporting, so the terminal shows the test cases and whether they pass or fail. The test files do not log test progress to a browser console.

Run the default suite (unit and mocked Route Handler tests; the database integration tests are skipped unless explicitly enabled):

```bash
vp test
```

Run a category directly with the Vite+ test command:

```bash
vp test run tests/unit
vp test run tests/api
```

Run one test file directly:

```bash
vp test run tests/api/listings/listings-collection.test.ts
vp test run tests/unit/auth-configuration.test.ts
```

Use the named suite scripts when you want a descriptive terminal header and the read-only database integration suite to be enabled deliberately:

```bash
vp run test:fast
vp run test:unit
vp run test:api
vp run test:integration
vp run test:db-permissions
vp run test:all
```

`test:all` includes unit tests, mocked API tests, and read-only PostgreSQL permission checks. The integration suite requires `DRIZZLE_DATABASE_URL` to connect as the restricted `evergreen_runtime` role. It checks permissions and approved reads only; it does not populate or mutate application data. Avoid running the integration suite against an unintended database.

Focused `test:*` aliases also cover seed data, account preferences, authentication configuration, the fixture-only identity allowlist, listing collection/item routes, media filename/size rules, media upload/deletion, reviews, seller profiles, saved listings, account profile settings, and avatar uploads.

The automated suite is not a substitute for the remaining manual browser/responsive, email-delivery, and production-environment verification.

### Review the demo-data population plan

The population tool performs read-only preflight by default and does not write data unless explicitly run in apply mode. It checks the configured Supabase project, database-role grants/RLS policies, fixture records, listing cap, Storage bucket settings, and existing media bytes.

```bash
npm run populate:dry-run
```

The first run uses a pinned tsx runner and may need network access to download it. The 0011 checksum discrepancy remains unresolved and is explicitly acknowledged, not repaired: the original bytes could not be recovered, so do not edit migration 0011 or its ledger row. Apply mode requires the explicit `--apply --confirm-project vcsotaclvwvbpqiljkuk` flags, a clean preflight, and valid local `seed/credentials`; it creates synthetic accounts/records and uploads missing fixture media. Do not run apply mode until you are ready for those writes. See agent-files/IMPLEMENTATION_HANDOFF.md for the review evidence and remaining verification tasks.

## Client Components

The application intentionally minimizes Client Components. Components remain Server Components unless browser APIs, React state, event handlers, client-side navigation, animation, or other interactive browser behavior is required.

### `Filters.tsx`

Location: `src/components/Filters.tsx`

`Filters.tsx` manages interactive filtering controls and updates URL search parameters. It does not fetch property data directly.

### `Layout/Menu.tsx`

Location: `src/components/Layout/Menu.tsx`

`Menu.tsx` uses client state, events, and Framer Motion for mobile navigation.

### `ListingMediaCarousel.tsx`

Location: `src/components/ListingMediaCarousel.tsx`

`ListingMediaCarousel.tsx` is a Client Component because Embla Carousel requires browser-side interaction.

## Challenges & Lessons Learned

- Understanding Next.js data-fetching strategies and Server Component boundaries
- Structuring a full-stack Next.js application with separation between UI, database logic, and utilities
- Integrating Supabase PostgreSQL and Storage
- Using URL search parameters as persistent and shareable filter state
- Building reusable media components for image and video listings
- Debugging TypeScript, image optimization, environment variables, and deployment differences between local development and Netlify production
- Handling expiring Supabase signed media URLs safely in server-rendered pages

## Author

Bryan Reyes
