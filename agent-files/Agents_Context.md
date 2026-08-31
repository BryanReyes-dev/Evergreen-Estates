# EverGreen Estates — Agents Context

> **Purpose:** Shared short-term working context between Bryan, ChatGPT, Codex, and other agents working on EverGreen Estates.
>
> This file is intentionally non-secret and may be committed to the public repository.
>
> **Important:** This is a living workspace for current context, implementation discoveries, hypotheses, open questions, and agent-to-agent communication. It is **not the authoritative architecture document**.
>
> Finalized architectural decisions belong in `agent-files/ARCHITECTURE.md` after Bryan explicitly approves them.

---

# 0. Context Budget & Maintenance Policy

This file is short-term working memory. Keep it high-signal and avoid turning it into a second architecture document.

## Hard rule: do not repeat context unnecessarily

Before adding a note, ask:

- Is this information actually new?
- Is it already documented elsewhere?
- Can an existing note be updated instead of adding another copy?
- Is it still relevant?
- Does it belong in `ARCHITECTURE.md` instead?

Prefer editing, consolidating, replacing, or removing stale context over appending another explanation of the same thing.

### Current policy

- Preferred working size: approximately **5,000–10,000 tokens**.
- Warning zone: **10,000–15,000 tokens**.
- Hard ceiling: **15,000 tokens** unless Bryan explicitly changes this policy.
- After a material edit, refresh the Context Metrics below.

### Context Metrics

- **Last measured:** 2026-08-31
- **Approximate token count:** intentionally kept compact
- **Preferred range:** 5,000–10,000 tokens
- **Hard ceiling:** 15,000 tokens
- **Status:** Healthy

---

# 1. How Agents Should Use This File

Agents working on EverGreen Estates should read this file when beginning substantial work.

Clearly distinguish:

- established facts
- current implementation plans
- hypotheses
- proposals
- open questions
- rejected ideas
- implementation discoveries
- finalized architecture

Do not silently turn a hypothesis into a requirement or architectural decision.

## Architecture authority rule

`agent-files/ARCHITECTURE.md` is the authoritative record of finalized project architecture.

**Agents must ask Bryan for explicit permission before modifying `ARCHITECTURE.md`.**

If Bryan approves an architectural decision:

1. Record the finalized decision in `ARCHITECTURE.md`.
2. Remove or reduce the corresponding architectural material from this file.
3. Keep only the short-term context needed for current work.

Never silently promote working context into architecture.

---

# 2. Project Identity

EverGreen Estates is a full-stack real estate web application built with Next.js, TypeScript, Supabase, Tailwind CSS, shadcn/ui, and Framer Motion.

The current application focuses on:

- browsing property listings
- property detail pages
- search and filtering
- URL-based shareable filters
- Supabase-backed property data
- Supabase Storage property images
- responsive, accessible UI

The application uses the Next.js App Router and intentionally keeps most components as Server Components unless browser interactivity requires a Client Component.

---

# 3. Current Implementation

The repository currently uses this broad separation:

```text
Next.js App Router
       │
       ├── Server Components
       │      └── data fetching / rendering
       │
       ├── Client Components
       │      └── browser interaction / navigation
       │
       ├── db/
       │      └── Supabase queries and database helpers
       │
       └── lib/
              └── shared utilities
```

The `src/db` directory is the database boundary. UI components should not contain duplicated database-query logic when an appropriate database helper already exists.

---

# 4. Data and Filtering Direction

Property data is fetched server-side through Supabase.

The filtering flow is:

```text
User changes filters
        ↓
Filters Client Component
        ↓
URL search parameters
        ↓
Next.js Server Component
        ↓
Supabase query
        ↓
Filtered property results
```

The client-side filter UI should not directly become a second property-data fetching layer unless a future architectural decision explicitly changes this boundary.

Shareable URLs are an intentional feature of the search/filtering system.

---

# 5. Client Component Philosophy

Keep Client Components as small and isolated as practical.

A component should remain a Server Component unless it requires browser-specific behavior such as:

- React state
- event handlers
- browser APIs
- client navigation hooks
- interactive animation behavior

Known interactive areas include the filtering UI, mobile navigation, and future media-carousel behavior. shadcn/ui components may also require Client Components where their implementation requires browser interaction.

Do not add `"use client"` to an entire subtree when only a small interactive component requires it.

---

# 6. Supabase and Storage

Supabase currently provides:

- PostgreSQL property data
- property image storage
- the application database client integration

Property images are stored in Supabase Storage and served through the application's image pipeline.

Environment variables are required for local development and deployment. Secrets must never be committed to the repository.

---

# 7. UI, Icons, Fonts, and Reusable Components

## Icon convention

EverGreen Estates uses **Hugeicons** as its project icon system. `components.json` is configured with `"iconLibrary": "hugeicons"`.

Do not introduce Lucide icons into UI code merely because shadcn examples commonly use Lucide. shadcn/ui is the UI-component system; Hugeicons is the project's icon system.

Use the existing Hugeicons React pattern:

```tsx
import { HugeiconsIcon } from "@hugeicons/react";
import { HeartIcon } from "@hugeicons/core-free-icons";

<HugeiconsIcon icon={HeartIcon} size={24} />
```

Prefer the `size` prop for fixed icon sizes and Tailwind sizing classes when responsive icon dimensions are needed. Avoid mixing icon libraries for equivalent UI actions.

A `lucide-react` dependency was recently added during listing-page work, but the current project convention remains Hugeicons. Do not use the dependency for new UI unless Bryan explicitly decides to standardize on Lucide instead.

## Typography convention

Figtree is the primary project/UI font.

Maitree, Lato, and Kanit have been added to the current work as additional available font families for intentional use. They should have clear roles rather than being mixed arbitrarily throughout the interface.

The project currently uses the traditional Tailwind configuration (`tailwind.config.js`) for custom font-family utilities. Do not migrate the project's CSS to a different Tailwind setup just to add a font.

Current intended Tailwind font utilities:

```text
font-sans    → Figtree
font-maitree → Maitree
font-lato    → Lato
font-kanit   → Kanit
```

Use secondary fonts deliberately, especially on property-detail content, titles, branding, or other areas where their visual character is useful. Figtree remains the default UI typeface unless the design calls for another font.

## Listing-detail work in progress

Individual listing pages are being built from the existing listing data. The current page direction includes displaying the property's title, price, address, description, and a favorite/heart action. The goal is to continue expanding this page using reusable components rather than duplicating listing UI.

The next planned reusable UI pieces are:

1. **Listing media carousel**
2. **Listing star rating display**

### Listing media carousel

The carousel should behave as a slideshow and support:

- normal images
- animated GIFs
- videos
- previous/next navigation
- swipe/drag interaction where appropriate
- autoplay/slideshow behavior
- responsive presentation

The preferred implementation direction is to use **Embla Carousel for carousel mechanics**, with its autoplay plugin, while keeping media rendering under Evergreen's control. Each slide can render the appropriate media element (`Image`, `<img>`, or `<video>`) based on media type. Do not build carousel mechanics from scratch unless there is a concrete requirement Embla cannot satisfy.

A future media model should distinguish media types instead of assuming every listing media item is an image. The existing `Houselisting.images` field may need to evolve when this is implemented.

### Listing star ratings

Listing ratings are mock/read-only review ratings for the current listing UI. The value is on a **1–5 scale** and must support fractional values such as `1.5`, `2.5`, `3.5`, or `4.5`.

Bryan prefers using the **React Stars library** for this rather than implementing a custom star-rating component with Hugeicons. Prefer a mature library for this small, generic interaction/presentation requirement if it provides the required fractional/read-only display cleanly.

The desired usage should remain simple at the listing level, conceptually:

```tsx
<ReactStars value={listing.stars} edit={false} half />
```

The exact package/API must be verified against the installed/current dependency before implementation. Do not assume an API without checking the package version.

Hugeicons should still be used for other Evergreen UI icons; React Stars is an intentional exception for the star-rating visualization.

---

# 8. Current Work / Implementation Notes

Use this section for discoveries that another agent needs to know while active work is in progress.

### Current thoughts

- Finish the individual listing-detail experience after the reusable media carousel and rating pieces are established.
- Prefer existing libraries for non-unique, interaction-heavy behavior when they reduce implementation complexity and fit the current stack.
- Keep reusable UI components focused and composable rather than putting all listing-page behavior into one large component.

### Repository observations

- Recent listing-detail work added title, price, address, description, and a Hugeicons heart action.
- Recent typography work added Maitree, Lato, and Kanit as available fonts through `next/font/google` and Tailwind font-family definitions.
- The repository's shadcn configuration explicitly uses Hugeicons.
- The project recently added `lucide-react`, but this does not change the intended icon convention unless Bryan explicitly approves that change.

### Concerns / risks

- Do not accidentally introduce a second icon system when installing or configuring shadcn components.
- Do not migrate Tailwind configuration casually; the current repository uses a traditional `tailwind.config.js` setup and working CSS directives.
- Media carousel implementation must account for video behavior and autoplay interaction rather than treating every asset as a static image.
- Fractional ratings must render accurately and remain read-only for the current mock-review use case.
- Keep Client Components isolated to the carousel/interactivity rather than converting the entire listing page to a Client Component.

### Future thoughts

- Consider a typed listing-media model (`image`, `gif`, `video`) when carousel work begins.
- Consider thumbnails or pagination indicators for the property media carousel after the core slideshow works.
- Consider pausing carousel autoplay when a video is playing or when the user interacts, depending on the final UX.

---

# 9. Agent Communication

## ChatGPT

Use this section for concise handoff information that another agent needs. Do not repeat the architecture document here.

Current handoff: Listing-detail work is active. Before finishing the page, establish the reusable media slideshow and fractional read-only rating components. Preferred media solution: Embla Carousel + autoplay. Preferred rating solution: React Stars. Project icon convention: Hugeicons. Primary font: Figtree, with Maitree/Lato/Kanit available for deliberate secondary use.

## Codex

Use this section for implementation discoveries, test results, and repository observations that should survive an agent handoff.

---

# 10. Maintenance Reminder for Future Agents

**Do not let this file become a second architecture document.**

When a concept is finalized, move the authoritative architectural decision to `ARCHITECTURE.md` after Bryan's approval and reduce the duplicate context here.

Prefer replacement over accumulation. If an implementation detail changes, update the old note instead of adding a conflicting note underneath it.
