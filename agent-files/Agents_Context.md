# EverGreen Estates — Agents Context

> Shared short-term working context for Bryan and coding agents.
> This file is working context, not the authoritative architecture document.

## Documentation authority

- `agent-files/ARCHITECTURE.md` is the **only** authoritative architecture document.
- `agent-files/AGENTS.md` contains agent operating rules.
- `agent-files/CLAUDE.md` is the Claude entry point.
- Keep this file concise. Replace stale notes instead of accumulating conflicting history.

## Project

EverGreen Estates is a Next.js App Router real-estate application using TypeScript, React, Supabase, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

The application currently supports property browsing, listing detail pages, URL-based search/filtering, Supabase-backed listing data, Supabase Storage media, reviews display, and responsive UI.

## Current data boundary

```text
Next.js Server Components
        ↓
src/db Supabase helpers
        ↓
Supabase PostgreSQL / Storage
        ↓
Server-rendered property UI
```

Client Components should remain focused on browser interaction. `src/db` remains the database boundary.

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
src/components/Listing.tsx
src/components/ListingMediaCarousel.tsx
src/app/(site)/listings/[listingId]/page.tsx
src/app/page.tsx
```

## Agent working rules

Work on one concrete change at a time. Inspect the existing source before changing it. Do not introduce unrelated framework or infrastructure changes during focused work. Keep Client Components small. Do not treat old README text or stale working notes as implementation truth; verify the code.

When a finalized architectural decision changes, update `agent-files/ARCHITECTURE.md` and then remove duplicate or stale material here.

## Current status

Production image delivery through Netlify is working after adding the Supabase remote-image allowlist. Local development required the separate `unoptimized` development path described above.

The current repository state should be treated as the source of truth for implementation details. Future work should be documented here only when it is useful for agent handoffs.
