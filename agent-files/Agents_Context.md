# EverGreen Estates — Agents Context

> **Purpose:** Shared short-term working context between Bryan, ChatGPT, Codex, and other agents working on EverGreen Estates.
>
> This file is intentionally non-secret and may be committed to the public repository.
>
> This is a living workspace for current context, implementation discoveries, hypotheses, open questions, and agent-to-agent communication. It is **not the authoritative architecture document**.
>
> Finalized architectural decisions belong in `agent-files/ARCHITECTURE.md` after Bryan explicitly approves them.

---

# 0. Context Budget & Maintenance Policy

Keep this file high-signal and compact. Prefer editing, consolidating, replacing, or removing stale context over appending duplicate explanations.

- Preferred working size: approximately **5,000–10,000 tokens**.
- Warning zone: **10,000–15,000 tokens**.
- Hard ceiling: **15,000 tokens** unless Bryan explicitly changes this policy.
- Last measured: 2026-09-05
- Status: Healthy

---

# 1. How Agents Should Use This File

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

If Bryan approves an architectural decision, record the finalized decision there and reduce the corresponding temporary material in this file.

---

# 2. Project Identity

EverGreen Estates is a full-stack real estate web application built with Next.js, TypeScript, Supabase, Tailwind CSS, shadcn/ui, and Framer Motion.

The application focuses on:

- browsing property listings
- property detail pages
- search and filtering
- URL-based shareable filters
- Supabase-backed property data
- Supabase Storage property media
- responsive, accessible UI

The application uses the Next.js App Router and intentionally keeps most components as Server Components unless browser interactivity requires a Client Component.

---

# 3. Current Implementation

Broad separation:

```text
Next.js App Router
       │
       ├── Server Components
       │      └── data fetching / rendering
       │
       ├── Client Components
       │      └── browser interaction / navigation / animation
       │
       ├── db/
       │      └── Supabase queries and database helpers
       │
       └── lib/
              └── shared utilities
```

The `src/db` directory is the database boundary. UI components should not contain duplicated database-query logic when an appropriate database helper already exists.

Property media currently flows from the listing's `images` array through a storage URL resolver and into the reusable listing media carousel.

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

The listing media carousel is intentionally a Client Component because Embla and interactive media controls require browser-side behavior.

Do not add `"use client"` to an entire subtree when only a small interactive component requires it.

---

# 6. Supabase and Storage

Supabase currently provides:

- PostgreSQL property data
- property media storage
- application database integration

The `property-images` bucket currently supports:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/avif`
- `image/gif`
- `video/mp4`
- `video/webm`

Listing media is currently served through Supabase signed URLs. Signed URLs may contain query parameters, so media-type detection must strip the query/hash before checking the file extension.

Environment variables are required for local development and deployment. Secrets must never be committed to the repository.

---

# 7. UI, Icons, Fonts, and Reusable Components

## Icon convention

EverGreen Estates uses **Hugeicons** as its project icon system. `components.json` is configured with `"iconLibrary": "hugeicons"`.

Do not introduce Lucide icons into new UI merely because shadcn examples commonly use Lucide. shadcn/ui is the UI-component system; Hugeicons is the project's icon system.

Use the existing Hugeicons React pattern:

```tsx
import { HugeiconsIcon } from "@hugeicons/react";
import { HeartIcon } from "@hugeicons/core-free-icons";

<HugeiconsIcon icon={HeartIcon} size={24} />
```

A `lucide-react` dependency exists from earlier listing-page work, but the project convention remains Hugeicons unless Bryan explicitly changes it.

## Typography convention

Figtree is the primary project/UI font.

Maitree, Lato, and Kanit are available for deliberate secondary use.

The project uses the traditional Tailwind configuration (`tailwind.config.js`). Do not migrate Tailwind configuration casually.

Current intended font utilities:

```text
font-sans    → Figtree
font-maitree → Maitree
font-lato    → Lato
font-kanit   → Kanit
```

---

# 8. Listing Detail and Media Carousel

Individual listing pages currently display listing information including title, price, address, description, a favorite/heart action, and listing media.

## Listing media model

The reusable media carousel uses:

```ts
type ListingMedia = {
  type: "image" | "gif" | "video";
  src: string;
  alt?: string;
};
```

`listing.images` remains the current source of truth for media order. The existing storage helper preserves database-listed media order and appends storage files not yet present in the database array.

Supported rendering:

- `image` → Next.js `Image`
- `gif` → native `<img>`
- `video` → native `<video>`

Videos currently use autoplay, muted playback, looping, `playsInline`, native controls, metadata preload, and disabled Picture-in-Picture/remote playback.

GIFs are intentionally supported as GIFs for now. Media normalization to MP4/WebM may be considered later but is not current work.

## Carousel implementation

The reusable `ListingMediaCarousel` currently uses **Embla Carousel** for carousel mechanics.

Implemented core behavior:

- multiple media slides
- image/GIF/video rendering
- previous/next navigation
- swipe/drag behavior through Embla
- loop option
- video autoplay

The listing-detail hero image remains separate from the carousel. Do not automatically replace the hero with the carousel unless Bryan explicitly requests that change.

### Current next task: pagination dots

The immediate carousel task is **pagination dots only**. UI spacing, visual polish, carousel layout, and custom video controls are intentionally deferred until after authentication.

The intended pagination behavior is:

- one pagination position per media item
- Embla's selected snap/index determines the active position
- clicking a pagination position should navigate to that slide
- inactive positions can be simple dots
- the active indicator should eventually be a **single animated white droplet/indicator that moves between positions**, rather than separate active dots appearing/disappearing

The current implementation should first establish correct selected-index synchronization with Embla before adding the animation.

### Droplet animation direction

Bryan wants the active white pagination indicator to visually travel from one position to another with a **dropping/physics-like motion**, resembling a small liquid droplet transferring between pagination positions rather than a normal dot transition.

Framer Motion is already installed and should be evaluated first for this. Its spring-based animation can provide physical motion without necessarily requiring a full physics engine.

A separate physics library is **not currently an architectural requirement**. A full engine such as Matter.js would likely be excessive for a small UI indicator unless later testing shows that spring animation cannot produce the desired droplet behavior. If true fluid deformation/physics is required, investigate a focused physics or spring library only after the simpler Framer Motion approach is prototyped.

The droplet should be treated as one moving visual element positioned relative to the pagination track; do not create a separate animated active dot for every pagination item.

### Deferred carousel work

Do not work on these until Bryan says to:

- final carousel spacing
- final carousel dimensions/layout
- pagination visual polish beyond the functional indicator
- thumbnail UI
- custom video controls
- click-to-pause/play video behavior
- double-click/tap seeking
- custom progress bar
- playback-speed UI
- advanced autoplay/video interaction rules

---

# 9. Reviews and Authentication Direction

The next broader product work is expected to establish a reviews system before authentication, followed by authentication.

The conceptual review model is:

```text
Review
  listing_id
  user_id
  rating
  comment
  created_at
```

Once real reviews exist, listing rating/count should be derived from review data rather than treating a separate `stars` field as the long-term source of truth.

Authentication will later provide the identity needed for saved listings, reviews, profiles, and other user-specific behavior.

Current intended sequence:

1. Finish carousel pagination/droplet behavior.
2. Build reviews system.
3. Build authentication.
4. Return to carousel UI/spacing/layout and later custom video controls.

Do not redesign the entire data model around authentication before the reviews work is actually underway.

---

# 10. Current Work / Implementation Notes

### Repository observations

- Listing-detail page is actively being developed.
- `ListingMediaCarousel.tsx` is currently the primary interactive media component.
- `MediaType.ts` correctly strips `?query` and `#hash` before identifying extensions, which is required for Supabase signed media URLs.
- `GetImageUrl.ts` now effectively resolves listing media URLs rather than only image URLs; a future rename to something such as `GetMediaUrls.ts` or `GetListingMedia.ts` can be considered, but is not current work.
- The current `Houselisting.images` field remains the source of truth for media order.
- The project intentionally minimizes Client Components.

### Working principles

- Work on **one concrete feature at a time**.
- Do not mix carousel pagination work with later UI polish.
- Prefer existing libraries for interaction-heavy behavior when they fit the requirement.
- Do not add a dependency simply because an effect sounds like it needs one; prototype with the existing Framer Motion capability first.
- Keep temporary implementation discoveries here rather than promoting them to architecture without Bryan's approval.

---

# 11. Agent Communication

## ChatGPT

Current handoff: Core listing media carousel is implemented with Embla and supports image, GIF, and video media. The immediate task is pagination dots. Bryan wants the active indicator to eventually behave like a physically moving white droplet that transfers between pagination positions. Framer Motion is already available; investigate spring/physics-like animation with it before considering a dedicated physics engine.

After pagination is complete, the planned product sequence is reviews → authentication → carousel UI/layout polish → advanced custom video controls.

## Codex

Use this section for implementation discoveries, test results, and repository observations that should survive an agent handoff.

---

# 12. Maintenance Reminder

**Do not let this file become a second architecture document.**

When a concept is finalized, move the authoritative architectural decision to `ARCHITECTURE.md` after Bryan's approval and reduce duplicate context here.

Prefer replacement over accumulation. If an implementation detail changes, update the existing note instead of adding a conflicting note underneath it.
