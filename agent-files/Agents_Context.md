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

- **Last measured:** 2026-08-25
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

Known interactive areas include the filtering UI and mobile navigation. shadcn/ui components may also require Client Components where their implementation requires browser interaction.

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

# 7. Current Work / Implementation Notes

Use this section for discoveries that another agent needs to know while active work is in progress.

### Current thoughts

_Add only genuinely new observations._

### Repository observations

_Add useful implementation discoveries here._

### Concerns / risks

_Add concerns here. If a concern becomes a finalized architectural decision, ask Bryan before moving it into `ARCHITECTURE.md`._

### Future thoughts

_Add ideas worth discussing before implementation._

---

# 8. Agent Communication

## ChatGPT

Use this section for concise handoff information that another agent needs. Do not repeat the architecture document here.

## Codex

Use this section for implementation discoveries, test results, and repository observations that should survive an agent handoff.

---

# 9. Maintenance Reminder for Future Agents

**Do not let this file become a second architecture document.**

When a concept is finalized, move the authoritative architectural decision to `ARCHITECTURE.md` after Bryan's approval and reduce the duplicate context here.

Prefer replacement over accumulation. If an implementation detail changes, update the old note instead of adding a conflicting note underneath it.
