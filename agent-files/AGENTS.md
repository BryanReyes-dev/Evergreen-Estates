<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# EverGreen Estates Agent Instructions

EverGreen Estates is a full-stack real estate web application using Next.js App Router, TypeScript, Supabase, Tailwind CSS, shadcn/ui, and Framer Motion.

## Before Working

1. Read `agent-files/Agents_Context.md` for current working state.
2. Read `agent-files/ARCHITECTURE.md` for finalized architecture.
3. Read the relevant Next.js guidance in `node_modules/next/dist/docs/` when working on framework behavior.
4. Inspect the existing implementation before changing it.
5. Do not treat README plans or working context as implemented behavior without verifying the source.

## Project Boundaries

- Keep database operations within the established database boundary.
- Preserve the Server Component / Client Component separation unless the requested change requires otherwise.
- Keep URL-driven filtering and server-side data fetching aligned with the existing architecture.
- Do not introduce unrelated framework or infrastructure changes during focused work.

## Documentation Authority

- `ARCHITECTURE.md` is authoritative for finalized architecture.
- `Agents_Context.md` is temporary working context, discoveries, hypotheses, and handoffs.
- Do not silently promote working context into architecture.
- Architectural changes require Bryan's explicit approval before being recorded as finalized.
