# Evergreen Estates

Evergreen Estates is a full-stack real-estate marketplace built with Next.js, TypeScript, PostgreSQL, and Supabase. It supports public property discovery, URL-driven search and filtering, seller storefronts and listing management, reviews, saved homes, account preferences, authentication, and private listing media.

**Links:** [Live demo](https://evergreen-estates.netlify.app/) · [GitHub repository](https://github.com/BryanReyes-dev/Evergreen-Estates) · [Figma design](https://www.figma.com/design/SY5C36osUoFZLUtlRC3RDg/Evergreen-Estates?node-id=0-1&p=f&t=dISV54YArH5wU4rl-0)

## Overview & Tech Stack

### Features in source

- Public property browse and detail pages, server-side search, and shareable URL-driven filters.
- Seller profiles, published seller storefronts, and owner-scoped listing create/edit/delete flows.
- Review display and author-scoped create/edit/delete flows.
- Better Auth email/password sign-up, sign-in, session, sign-out, email verification, and password reset.
- Saved homes with persistent account state and a 100-listing limit.
- Account profile/avatar handling and saved browsing preferences.
- Supabase Storage listing media for images, GIFs, and videos, plus WebVTT video captions; private objects are delivered through signed URLs.
- Server-rendered pages with focused Client Components for interactive behavior.

The capabilities above are visible in the current source. They should not be interpreted as proof that every browser workflow, authentication email, database permission, or Netlify production behavior has passed a fresh end-to-end check.

### Stack

| Area | Technologies |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Base UI, Framer Motion, Embla Carousel, Hugeicons |
| Database | Supabase PostgreSQL, Drizzle ORM, Drizzle Kit, RLS |
| Authentication | Better Auth with the canonical public.users table |
| Media | Private Supabase Storage and server-issued signed URLs |
| Transactional email | Resend |
| Developer checks/tests | Vite+ (vp) with verbose Vitest-compatible tests |
| Hosting | Netlify, with production image optimization through Netlify Image CDN |

Vite+ is the development check/test workflow. Next.js remains the application framework and runtime.

## Development

### Requirements and setup

The package declares Node.js 24.22.1 and npm 11.19.1 through devEngines, matching the Node/npm versions shown in the Netlify build environment. Use the configured versions when possible.

Clone the repository and install dependencies:

    git clone https://github.com/BryanReyes-dev/Evergreen-Estates.git
    cd Evergreen-Estates
    npm install

Copy the environment template into a local ignored environment file and fill in values for the services you use:

    cp .env.example .env.local

Next.js loads .env.local; Drizzle Kit imports dotenv/config, which reads .env by default. For local migration commands, make sure DIRECT_URL is actually available to the process (for example, through an ignored local .env file or the shell). Never commit .env, .env.local, credentials, or generated fixture passwords.

Start the Next.js dev server:

    npm run dev

### Architecture and security boundaries

- DRIZZLE_DATABASE_URL is the read-only evergreen_runtime database connection for application reads.
- AUTH_DATABASE_URL is the restricted evergreen_auth connection for Better Auth data.
- APP_DATABASE_URL is the restricted evergreen_app connection for owner-scoped application writes.
- DIRECT_URL is a privileged Drizzle migration connection only; do not use it for request-time queries.
- Supabase JS is used for Storage operations, not as the application-table query layer.
- Keep secrets server-side. Only variables intentionally prefixed NEXT_PUBLIC_ should be exposed to the browser.
- Keep listing media in private Storage and use the existing signed-URL flow. GIF remains an image; MP4/WebM are videos; WebVTT is supported for video captions.

The full architecture and role boundaries are documented in [agents-files/ARCHITECTURE.md](./agents-files/ARCHITECTURE.md). Agent operating rules and current work status live in [agents-files/AGENTS.md](./agents-files/AGENTS.md) and [agents-files/Agents_Context.md](./agents-files/Agents_Context.md).

### Schema migrations

Migrations are versioned in drizzle/ and are applied using the privileged migration connection configured as DIRECT_URL. Review new SQL before applying it to a live database.

    vp exec drizzle-kit migrate

Never use the runtime read-only role or auth role for migrations. Do not edit the historical 0011_shared_read_role.sql migration or its Drizzle ledger row to force the known checksum/provenance discrepancy to disappear; migration 0021_reconcile_shared_read_role.sql is the forward-only reconciliation.

## Testing

Run checks and tests from the repository root with Vite+.

### Main commands

    # Formatting, lint, and static/type checks
    vp check

    # Run the checks without the formatting stage
    vp check --no-fmt

    # Default test suite (database integration remains opt-in)
    vp test

    # Fast isolated unit + mocked API tests; no database connection
    vp run test:fast

    # Run suites separately
    vp run test:unit
    vp run test:api

    # Read-only PostgreSQL permission tests
    vp run test:integration
    vp run test:db-permissions

    # Full unit + mocked API + read-only database permission suite
    vp run test:all

    # Production build
    npm run build

The database integration suites require DRIZZLE_DATABASE_URL to use the restricted evergreen_runtime role. They are intended for read-only permission checks, not fixture population. Avoid running them against an unintended project. A passing unit/API suite does not replace browser, email-delivery, and deployment verification.

### Focused test aliases

Use a specific alias while iterating; all aliases below are defined in package.json.

| Alias | Primary coverage |
|---|---|
| test:seed-data | Fixture counts, relationships, timestamps, contact values, and media manifest integrity |
| test:account-preferences | Preference defaults and accepted sort/layout values |
| test:auth-config | Email verification, token lifetime, reset-session revocation, and rate limits |
| test:fixture-auth | Allowlist for exact synthetic fixture identities |
| test:listing-collection | Listing search parsing and create validation/ownership rules |
| test:listing-item | Listing detail behavior and owner-scoped update/delete |
| test:listing-media | Media ordering, reorder validation, and stale-write conflicts |
| test:reviews | Review authentication, validation, author-scoped operations |
| test:seller-profiles | Seller enrollment/update validation and contact preferences |
| test:saved-listings | Saved-home authentication, user-ID protection, and UUID/state validation |
| test:account-profile | Account preferences and avatar URL handling |
| test:media-upload | Upload URL/completion input and authorization checks |
| test:media-delete | Media ownership, registration, and cleanup ordering |
| test:media-captions | WebVTT validation and authenticated video-caption upload rules |
| test:media-filenames | Allowed extensions, path traversal, and filename length |
| test:media-limits | Decimal 50,000,000-byte media ceiling |
| test:avatar | Avatar upload authentication and image-signature validation |
| test:db-permissions | Read-only allowed/denied PostgreSQL permission checks |

For the lower-level runner, individual categories/files can also be called directly:

    vp test run tests/unit
    vp test run tests/api
    vp test run tests/api/listings/listings-collection.test.ts
    vp test run tests/unit/auth-configuration.test.ts

The suite runner prints each selected suite's purpose and paths to the terminal. The repository does not configure a GitHub Actions quality workflow on this branch; do not assume a hosted CI job has run.

## Production

### Netlify build configuration

The repository includes netlify.toml with the build command npm run build, publish directory .next, and an allowlist for the configured Supabase image host used by Netlify Image CDN. Netlify's current Next.js adapter supports App Router, server rendering, Route Handlers, and image optimization; the typical build settings are next build and .next, and the committed npm run build command invokes next build. See [Netlify's Next.js setup guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) and [Next.js build configuration values](https://docs.netlify.com/snippets/frameworks/nextjs-config-values/).

That is repository configuration, not proof of a successful Netlify build. Before promoting a deploy, verify the Netlify site is connected to the intended repository/branch, the preview build completes, environment variables are set for the right deploy contexts, and the production runtime works. Use a Deploy Preview before changing the public site.

### Environment variables

Copy the names from .env.example. Add values in Netlify's site environment-variable settings rather than committing them. Netlify supports context-specific values for Production, Deploy Previews, and branch deploys; use separate values when the preview and production environments should not share credentials or data. See the [Netlify environment-variable guide](https://docs.netlify.com/build/environment-variables/overview/) and [Deploy Previews guide](https://docs.netlify.com/deploy/deploy-types/deploy-previews/).

| Variable | Purpose | Handling |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | Public/client configuration |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase public client key | Public/client configuration; keep RLS correct |
| SUPABASE_SECRET_KEY | Server-side Storage administration | Secret; never use in client code |
| DRIZZLE_DATABASE_URL | Read-only application reads | Secret; restricted evergreen_runtime login |
| AUTH_DATABASE_URL | Better Auth operations | Secret; restricted evergreen_auth login |
| APP_DATABASE_URL | Owner-scoped writes | Secret; restricted evergreen_app login |
| BETTER_AUTH_URL | Canonical deployed auth base URL | Must match the active site URL |
| BETTER_AUTH_SECRET | Better Auth signing/encryption secret | Secret; use a strong unique value |
| RESEND_API_KEY | Verification/reset email delivery | Secret |
| AUTH_EMAIL_FROM | Verified sender used by Resend | Must use a sender/domain verified in Resend |
| DIRECT_URL | Drizzle migrations | Privileged; use in a controlled migration environment, not request-time application code |

Set the production BETTER_AUTH_URL to the site URL used by that deployment, and verify any deploy-preview origin requirements before testing auth on previews. Configure and verify a Resend sender domain/address before expecting verification and password-reset emails to arrive. Do not put seed/credentials or fixture passwords in Netlify variables.

### Database and fixture safety

Recorded database verification from 2026-10-23 reports migration 0019 and the forward-only 0021 reconciliation applied to the configured Supabase project, with read-only catalog checks and a full population dry-run passing after 0021. The migration journal orders 0020 before 0021. This documentation update did not make a new live database connection, so confirm the migration ledger, role grants, and RLS policies against the exact project you intend to deploy.

The population utility is a developer-run script, not part of the Netlify build. It is pinned in source to project ref vcsotaclvwvbpqiljkuk; do not assume it accepts an arbitrary Supabase project. Start with the read-only dry run:

    npm run populate:dry-run

Apply mode makes writes: it provisions synthetic auth accounts and fixture records and uploads missing fixture media. Use it only after reviewing the preflight, preparing the ignored local seed/credentials, and confirming the exact configured project:

    npm run populate -- --apply --confirm-project vcsotaclvwvbpqiljkuk

Never run apply mode from a public endpoint, application startup, or the Netlify build. It must preserve unrelated rows and Storage objects. The historical 0011 checksum mismatch is acknowledged but unresolved; do not rewrite migration history to hide it.

## Future Improvements

- **Netlify release validation:** verify the actual site settings, preview and production variables, production build, runtime database connectivity, signed media images, and authentication email links. Record outcomes in agents-files/Agents_Context.md.
- **Authentication and email:** finish the end-to-end signup, verification, signin/signout, reset, and session-revocation checks on the deployed hostname after Resend sender verification.
- **Functional browser testing:** run manual workflows for listing ownership, seller publish/unpublish privacy, reviews, saved homes, media upload/reorder/delete/captions, account preferences, error/empty/loading states, keyboard use, and mobile widths.
- **Figma comparison:** compare navigation, listing cards/search controls, listing detail/gallery, account and seller forms, spacing/type, colors, focus and validation states. Do not claim pixel alignment until a comparison is performed.
- **Safer reusable fixture tooling:** make the population target configurable only through an explicit, reviewed safety mechanism rather than weakening the current project guard; keep dry-run read-only and preserve non-fixture data/objects.
- **Migration provenance:** keep the 0011 checksum mismatch documented as an exception unless the authentic historical migration bytes can be recovered. Never modify the existing ledger row as a shortcut.
- **Operations:** decide on an appropriate release/rollback procedure, backup/restore check, error monitoring, and environment separation for production versus previews.
