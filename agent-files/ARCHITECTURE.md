# EverGreen Estates Architecture

## Document Authority

This file is the **single authoritative record of finalized EverGreen Estates architectural decisions**.

`agent-files/Agents_Context.md` is working context only. `agent-files/AGENTS.md` contains agent operating rules. `agent-files/CLAUDE.md` is a Claude entry point. No other file is an architecture authority.

There must be only one authoritative architecture document for the project: `agent-files/ARCHITECTURE.md`.

---

## 1. Project Identity

EverGreen Estates is a full-stack real estate web application built with Next.js 16.x, React, TypeScript, Supabase, Tailwind CSS, shadcn/ui, Framer Motion, and Embla Carousel.

The application provides property browsing, property detail pages, search/filtering, URL-based filter state, reviews, and property media presentation.

---

## 2. Application Structure

The project uses the Next.js App Router with a `src` directory.

```text
src/
├── app/          routes, layouts, pages, server/client boundaries
├── components/   reusable UI and feature components
├── db/           Supabase queries and database helpers
└── lib/          shared utilities
```

`src/db` is the database boundary. Presentation components should not duplicate database-query logic when an appropriate helper already exists.

---

## 3. Server and Client Boundaries

Server Components are the default.

They handle server-side data fetching, Supabase queries, route rendering, and URL-driven search results.

Client Components are limited to browser behavior such as state, event handlers, client navigation, animation, and Embla carousel interaction.

The project should not convert server-rendered areas to Client Components merely for convenience.

---

## 4. Data and Search Architecture

Property data is fetched through the database layer and Supabase.

```text
Server Component
      ↓
src/db helper
      ↓
Supabase PostgreSQL / Storage
      ↓
Server Component
      ↓
Rendered UI
```

Property filtering uses URL search parameters as the state boundary.

```text
Filter UI
   ↓
URL search parameters
   ↓
Next.js navigation
   ↓
Server Component
   ↓
Supabase filtered query
```

This keeps filtered URLs shareable and keeps the property-data query server-driven.

---

## 5. Supabase and Media Storage

Supabase provides PostgreSQL application data and the `property-images` Storage bucket.

Listing media is represented by the listing's `media` array. The storage helper resolves the stored filenames to signed URLs and preserves database media ordering while appending storage files that are not yet listed in the database array.

Signed media URLs can contain query parameters, so media-type detection removes query strings and URL fragments before inspecting the file extension.

---

## 6. Listing Media Model

EverGreen Estates has exactly two application media categories:

```ts
type ListingMedia = {
  type: "image" | "video";
  src: string;
  alt?: string;
};
```

The mapping is:

```text
JPG / JPEG / PNG / WebP / AVIF / GIF → image
MP4 / WebM                           → video
```

GIF is intentionally an `image` category rather than a third media type.

`getMediaType()` strips query strings and fragments, then classifies `mp4` and `webm` as video. All other supported listing media is treated as image.

Rendering uses:

```text
image → Next.js <Image>
video → native <video controls>
```

The listing detail page uses the first media item as the featured media and the reusable `ListingMediaCarousel` for the complete media collection.

The carousel uses Embla for interaction and is a Client Component because it requires browser-side behavior.

---

## 7. Image Optimization Architecture

The project uses a custom Next.js image loader at:

```text
src/lib/netlifyImageLoader.ts
```

The loader generates Netlify Image CDN URLs in the form:

```text
/.netlify/images?url=...&w=...&q=...
```

Production image delivery therefore follows:

```text
Supabase signed image URL
        ↓
Next.js <Image>
        ↓
custom Netlify loader
        ↓
Netlify Image CDN
        ↓
optimized browser image
```

Netlify is configured to allow the project's Supabase remote image host through `[images].remote_images` in `netlify.toml`.

### Development behavior

The Netlify Image CDN does not exist on the local Next.js development server. Therefore:

```ts
unoptimized: process.env.NODE_ENV === 'development'
```

is intentional.

Local development uses the original remote image URL so `npm run dev` does not attempt to request `/.netlify/images`.

Production keeps image optimization enabled because `NODE_ENV` is not `development` there.

This is a deliberate environment boundary, not a separate image architecture.

---

## 8. Dynamic Signed URLs

Supabase listing media uses signed URLs with finite expiration.

Pages that depend on newly generated signed media URLs must not be allowed to serve indefinitely stale rendered data. The home page therefore uses request-time rendering with `dynamic = "force-dynamic"` for its featured listing data.

The application must preserve this requirement while signed URLs remain the media-delivery mechanism.

---

## 9. UI Architecture

The UI uses Tailwind CSS, shadcn/ui, Hugeicons, and Framer Motion.

The project follows a Server Component-first approach and keeps interactive behavior in focused Client Components.

Embla Carousel is the carousel mechanism for listing media.

---

## 10. Environment and Configuration

Local and deployment environments provide Supabase configuration through environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Secrets and credentials must never be committed.

Framework-sensitive changes must be checked against the installed Next.js documentation because the repository uses Next.js 16.x.

---

## 11. Development, Build, and Deployment

Development:

```text
npm run dev
    ↓
Next.js development server
    ↓
source remote images (no Netlify image CDN)
```

Production build:

```text
npm run build
    ↓
Next.js production build
    ↓
Netlify deployment
```

Production runtime:

```text
Netlify
  ↓
Next.js application
  ↓
Netlify Image CDN for <Image>
```

The repository is currently deployed through Netlify.

---

## 12. Architecture Principles

### Server-first

Prefer Server Components and server-side data fetching.

### Small client boundaries

Use Client Components only when browser execution is necessary.

### Database isolation

Keep Supabase queries and storage helpers under `src/db`.

### URL-driven filtering

Use URL search parameters for shareable property filters.

### Two media categories

Keep listing media classified as only `image` or `video`; GIF remains an image.

### Environment-aware image delivery

Use direct source URLs in local development and Netlify Image CDN optimization in production.

### Single architecture authority

Only `agent-files/ARCHITECTURE.md` is the authoritative architecture document.

---

## 13. Current Architecture Boundary

```text
┌─────────────────────────────────────────────┐
│               Next.js App Router            │
│                                             │
│  Server Components      Client Components   │
│  Pages / data           Filters / Menu      │
│  fetching               Embla interaction   │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             Application Data Layer          │
│                    src/db                   │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                  Supabase                   │
│                                             │
│      PostgreSQL           Storage           │
│      Listings             Property Media    │
└─────────────────────────────────────────────┘
                       │
                       │ signed image URL
                       ▼
┌─────────────────────────────────────────────┐
│             Next.js Image Layer             │
│                                             │
│  Development → source URL                  │
│  Production  → Netlify Image CDN           │
└─────────────────────────────────────────────┘
```

Future features may extend the application, but they are not architecture until explicitly finalized.
