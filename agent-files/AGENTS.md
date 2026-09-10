<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# EverGreen Estates Agent Instructions

EverGreen Estates is a full-stack real estate web application using Next.js App Router, TypeScript, Supabase, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

## Before Working

1. Read `agent-files/Agents_Context.md` for current working state.
2. Read `agent-files/ARCHITECTURE.md` for finalized architecture.
3. Read the relevant Next.js guidance in `node_modules/next/dist/docs/` when working on framework behavior.
4. Inspect the existing implementation before changing it.
5. Do not treat README plans or working context as implemented behavior without verifying the source.

## Project Boundaries

- Keep database operations within the established `src/db` boundary.
- Preserve the Server Component / Client Component separation unless the requested change requires otherwise.
- Keep URL-driven filtering and server-side data fetching aligned with the established architecture.
- Do not introduce unrelated framework or infrastructure changes during focused work.
- Keep listing media limited to the established `image` and `video` categories. GIF is an image category.

## Image Pipeline

The project uses `src/lib/netlifyImageLoader.ts` for production image optimization through Netlify Image CDN.

- In development, `next.config.ts` sets `images.unoptimized` to `true` so local `next dev` uses source image URLs and does not request the Netlify-only `/.netlify/images` endpoint.
- In production, image optimization remains enabled and the custom loader generates `/.netlify/images` requests.
- `netlify.toml` allowlists the project's Supabase remote image host.
- Do not remove or change this environment-aware behavior without checking both local development and Netlify production behavior.

## Documentation Authority

- `agent-files/ARCHITECTURE.md` is the **only** authoritative architecture document.
- `agent-files/Agents_Context.md` is temporary working context, discoveries, implementation notes, and handoffs.
- `agent-files/CLAUDE.md` is an entry point for Claude and should remain a lightweight include file.
- The README is human-facing documentation and should describe the implemented system, not stale plans.
- Do not create additional architecture documents.
- Architectural changes require Bryan's explicit approval before being recorded as finalized architecture.

## Working Style

Work on one concrete feature or fix at a time. Prefer the smallest change that correctly addresses the request. Verify the existing implementation and relevant framework documentation before changing framework-sensitive behavior.
