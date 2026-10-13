# EverGreen Estates — Agents Context

> Shared short-term working context for Bryan and coding agents.
> This file is working context, not the authoritative architecture document.

## Documentation authority

- `agent-files/ARCHITECTURE.md` is the **only** authoritative architecture document.
- `agent-files/AGENTS.md` contains agent operating rules.
- `agent-files/CLAUDE.md` is the Claude entry point.
- Keep this file concise. Replace stale notes instead of accumulating conflicting history.

## Project

EverGreen Estates is a Next.js App Router real-estate application using TypeScript, React, Supabase/PostgreSQL, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

The application currently supports property browsing, listing detail pages, URL-based search/filtering, Supabase-backed listing data, Supabase Storage media, reviews display, and responsive UI.

## Current data flow

The current public listing flow is approximately:

```text
Browser request
    ↓
Next.js Server Component / page
    ↓
src/db/queries/listings.ts
    ↓
Drizzle ORM + dedicated read-only PostgreSQL role
    ↓
Supabase PostgreSQL (grants + RLS)
    ↓
listing + reviews + public author identity returned to server
    ↓
Next.js renders UI
```

Supabase JS remains under `src/db/supabase` for Storage only (listing file discovery and signed URLs). Application-table reads have moved to Drizzle.

Media has a second related path:

```text
listing.media paths
    ↓
GetMediaUrls.ts
    ↓
Supabase Storage (`property-images`)
    ↓
signed media URLs
    ↓
Next.js media model
    ↓
Image → Next/Image → Netlify Image CDN in production
Video → native <video controls>
```

Client Components should remain focused on browser interaction. `src/db` remains the database boundary.

## Auth-readiness work before Better Auth

Before implementing Better Auth, the application needs a clear separation between **identity**, **public profile data**, **authorization**, and **database access**. Three concepts are currently being tracked for focused review:

1. **Public user-data exposure** — The Drizzle listing-detail query explicitly selects only review-author `id` and `name`. PostgreSQL column grants also restrict the runtime role to those user columns. Do not reintroduce a broad users selection into public review data.

2. **Better Auth identity ↔ application user/profile relationship** — Better Auth will own authentication/session identity, while EverGreen Estates still needs application-level user/profile data for things such as review authors. The intended conceptual boundary is:

```text
Better Auth identity
        ↓
application users/profile data
        ↓
reviews.user_id
```

Do not assume Better Auth's internal user/session tables are the same thing as the application's public `users` data. This relationship should be researched and explicitly designed before implementation.

3. **Authorization and Supabase RLS boundary** — The current Supabase client uses the public/anonymous Supabase key and is not automatically connected to a Better Auth session. Better Auth cookies/sessions therefore do not automatically make `auth.uid()` available to Supabase/Postgres. Do not rewrite RLS around `auth.uid()` until the Better Auth ↔ Supabase authorization boundary is deliberately designed and verified.

The intended learning/implementation sequence is to verify the Drizzle read path and runtime-role permissions first, then design Better Auth's canonical UUID identity and authenticated write authorization. Do not migrate user IDs until a data-preserving plan is ready.

Do not create `proxy.ts`, add route protection, or redesign Supabase RLS merely as preparation. Those are implementation decisions that come after the auth/session/authorization design is understood.

## Listing media

The listing model uses `media: string[]` as the media collection.

There are exactly two application media categories:

```ts
type ListingMedia = {
  type: "image" | "video";
  src: string;
  alt?: string;
};
```

Classification:

- JPG/JPEG/PNG/WebP/AVIF/GIF → `image`
- MP4/WebM → `video`

GIF is an image category, not a separate media type.

`getMediaType()` strips the query string and URL fragment before checking the extension so signed Supabase URLs are classified correctly.

Rendering:

- `image` → Next.js `<Image>`
- `video` → native `<video controls>`

`ListingMediaCarousel.tsx` uses Embla and is intentionally a Client Component.

## Supabase media URLs

`src/db/supabase/util/GetMediaUrls.ts` resolves listing media from the `property-images` bucket into signed URLs. Database media order is preserved and storage-only files are appended.

Because signed URLs expire, server-rendered pages that depend on newly generated media URLs must not remain indefinitely cached. The home page currently uses `dynamic = "force-dynamic"`.

## Image optimization: development vs production

`src/lib/netlifyImageLoader.ts` is a plain utility that generates Netlify Image CDN URLs:

```text
/.netlify/images?url=...&w=...&q=...
```

`next.config.ts` intentionally uses:

```ts
unoptimized: process.env.NODE_ENV === 'development'
```

This means:

```text
Local npm run dev
→ original Supabase image URL
→ no local request to /.netlify/images

Netlify production
→ custom Netlify image loader
→ /.netlify/images
→ optimized delivery
```

This difference is intentional because the local Next.js development server does not provide Netlify's Image CDN endpoint.

`next.config.ts` still contains Supabase `remotePatterns` for public and signed storage paths.

`netlify.toml` contains an `[images] remote_images` allowlist for the project's Supabase host so Netlify can optimize remote images in production.

Do not set development back to Netlify Image CDN URLs unless the local environment gains an equivalent image service.

## Current implementation files

Important current files include:

```text
next.config.ts
netlify.toml
src/lib/netlifyImageLoader.ts
src/app/types.ts
src/db/supabase/util/MediaType.ts
src/db/supabase/util/GetMediaUrls.ts
src/db/queries/listings.ts
src/components/Listing.tsx
src/components/ListingMediaCarousel.tsx
src/app/(site)/listings/[listingId]/page.tsx
src/app/page.tsx
```

## Agent working rules

Work on one concrete change at a time. Inspect the existing source before changing it. Do not introduce unrelated framework or infrastructure changes during focused work. Keep Client Components small. Do not treat old README text or stale working notes as implementation truth; verify the code.

When a finalized architectural decision changes, update `agent-files/ARCHITECTURE.md` and then remove duplicate or stale material here.

## Current status

Production image delivery through Netlify is working after adding the Supabase remote-image allowlist. Local development uses the source URL path described above.

Public listing reads use Drizzle with `DRIZZLE_DATABASE_URL`, which must be a dedicated login role that is a member of `evergreen_readonly`. The migration creates the non-login group role and grants SELECT-only table/column permissions plus matching RLS policy targets. Create the runtime login and set its password outside version control, then configure the transaction-pooler URL locally and in the deployment environment.

The current application has not integrated Better Auth yet. The nullable `users.auth_user_id` column remains a transitional placeholder until the canonical user-ID migration is designed and tested.
