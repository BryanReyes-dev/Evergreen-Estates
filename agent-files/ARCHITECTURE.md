# EverGreen Estates Architecture

## Document Authority

This file is the **single authoritative record of finalized EverGreen Estates architectural decisions**.

`agent-files/Agents_Context.md` is short-term working context. It may contain implementation discoveries, hypotheses, open questions, and current work, but finalized architecture belongs here after Bryan explicitly approves it.

There must be only one authoritative architecture document for the project: `agent-files/ARCHITECTURE.md`.

---

## 1. Project Identity

EverGreen Estates is a full-stack real estate web application built around the Next.js App Router.

The application is responsible for presenting property listings, property details, search/filtering, and related real-estate UI while using Supabase for application data and property image storage.

The current technology boundary is:

```text
EverGreen Estates
       ↓
Next.js App Router
       ↓
React / TypeScript UI
       ↓
Application data layer
       ↓
Supabase PostgreSQL / Storage
```

Next.js is currently the application framework and runtime boundary. Supabase is the backend data/storage service.

---

## 2. Application Structure

The application uses a `src`-based Next.js App Router structure.

```text
src/
├── app/
│   └── Next.js routes, layouts, pages, and server/client boundaries
│
├── components/
│   ├── ui/
│   ├── Layout/
│   └── feature components
│
├── db/
│   └── Supabase queries and database helpers
│
└── lib/
    └── shared utilities
```

The architecture separates:

- route/page composition
- reusable UI components
- database operations
- shared utilities

Database logic belongs in `src/db` rather than being duplicated throughout presentation components.

---

## 3. Next.js App Router

EverGreen Estates uses the Next.js App Router.

Server Components are the default application boundary.

Server Components are responsible for work such as:

- fetching property data
- calling Supabase queries
- rendering listing results
- receiving and interpreting URL search parameters
- reducing unnecessary client-side JavaScript

Client Components are introduced only where browser-side interactivity is required.

The application should preserve this Server Component-first architecture rather than converting large sections of the application to client rendering for convenience.

---

## 4. Data Fetching Architecture

Property data is fetched through the application's database layer and Supabase.

The intended data flow is:

```text
Next.js Server Component
        ↓
Database helper / query
        ↓
Supabase
        ↓
PostgreSQL property data
        ↓
Server Component
        ↓
Rendered property UI
```

Database operations should remain isolated from presentation components wherever practical.

A Client Component may control UI state, but it should not duplicate the application's server-side property-data fetching architecture merely to implement an interactive control.

---

## 5. Search and Filtering Architecture

The property search system uses URL search parameters as the state boundary for filters.

The finalized interaction model is:

```text
User changes filter
        ↓
Filters Client Component
        ↓
Update URL search parameters
        ↓
Next.js navigation
        ↓
Server Component receives parameters
        ↓
Supabase query
        ↓
Filtered property results
```

This provides shareable and persistent filtered URLs while keeping property-data retrieval server-driven.

The filtering UI is responsible for browser interaction and URL updates. It does not directly become the authoritative property-data source.

---

## 6. Client Component Boundary

Client Components are used when functionality requires browser execution.

Examples currently include:

### `src/components/Filters.tsx`

`Filters.tsx` is a Client Component because it requires interactive filter controls and client navigation APIs.

Its responsibilities include:

- managing interactive filter state
- responding to user input
- updating URL search parameters
- coordinating the filter UI

It should not own the server-side property query.

### `src/components/Layout/Menu.tsx`

`Menu.tsx` is a Client Component because mobile navigation requires interactive state and browser event handling. Framer Motion is also used for the menu's animation behavior.

### shadcn/ui components

Some components under `src/components/ui` are Client Components when their implementation requires browser interaction. Their client boundary should remain local to the component that needs it.

---

## 7. Supabase Architecture

Supabase provides the application's current backend services.

```text
EverGreen Estates
       │
       ├── Supabase PostgreSQL
       │      └── property/listing data
       │
       └── Supabase Storage
              └── property images
```

The database integration is isolated under `src/db`.

Supabase Storage is used for property images rather than treating the application repository as the primary property-image store.

Credentials and environment-specific configuration must remain outside committed source code.

---

## 8. Image Architecture

Property images are stored in Supabase Storage and rendered through Next.js image handling where appropriate.

The image pipeline is conceptually:

```text
Supabase Storage
       ↓
Property image URL
       ↓
Next.js image handling
       ↓
Optimized browser delivery
```

Image configuration must account for the remote image host and the requirements of the deployment environment.

---

## 9. UI Architecture

The UI is component-based and uses Tailwind CSS, shadcn/ui, and Framer Motion.

The project should favor reusable components over large page-specific components when a UI pattern is repeated.

Presentation concerns should remain separate from database-query concerns.

The UI should preserve responsive/mobile-first behavior and accessibility considerations already established by the project.

---

## 10. URL State as Application State

URL search parameters are an intentional application-state mechanism for property filtering.

A filter state should be representable in the URL when it affects the server-side search result.

This provides:

- shareable search states
- browser navigation support
- server-rendered filtered results
- a clear boundary between interactive controls and data retrieval

The application should avoid introducing a separate global state system for filters unless a future architectural decision establishes a concrete need.

---

## 11. Environment and Configuration

Environment-specific Supabase configuration is supplied through environment variables.

The repository must not commit real credentials or secret values.

Expected application configuration includes the Supabase project URL and public application key required by the current Supabase integration.

Local development and deployment environments may provide different values while preserving the same application-level configuration interface.

---

## 12. Development and Production

The repository currently uses standard Next.js development and production commands:

```text
npm run dev
     ↓
Next.js development server
```

and:

```text
npm run build
     ↓
Production Next.js build
     ↓
npm start
     ↓
Next.js production server
```

The project currently uses Next.js 16.x dependencies. Agents must consult the installed Next.js documentation for the actual version in the working tree before making framework-sensitive changes.

No custom desktop runtime or custom process supervisor is currently part of EverGreen Estates architecture.

---

## 13. Deployment

The application is currently deployed through Netlify using the Next.js runtime.

Deployment configuration must preserve the requirements of the Next.js application, including server-side data access and image handling.

Local development behavior should not be assumed to be identical to the production hosting environment.

---

## 14. Architectural Principles

### Server-first

Prefer Server Components and server-side data fetching for data that does not require browser execution.

### Small client boundaries

Use Client Components only where browser interactivity is necessary.

### Database isolation

Keep Supabase queries and database helpers in `src/db` rather than coupling database access directly to reusable presentation components.

### URL-driven search

Use URL search parameters as the state boundary for shareable property filtering.

### Reusable UI

Prefer reusable components and established shadcn/ui primitives over repeated custom implementations.

### Explicit architecture changes

Architectural changes should be discussed with Bryan before being recorded as finalized decisions in this document.

---

## 15. Current Architecture Boundary

The current system can be represented as:

```text
┌────────────────────────────────────────────┐
│              Next.js App Router            │
│                                            │
│  Server Components       Client Components │
│  Pages / Layouts         Filters / Menu    │
│  Data rendering          Browser behavior  │
└──────────────────────┬─────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│             Application Data Layer         │
│                 src/db                     │
└──────────────────────┬─────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│                  Supabase                  │
│                                            │
│       PostgreSQL       Storage             │
│       Listings         Property Images     │
└────────────────────────────────────────────┘
```

This is the current finalized architecture. Future additions such as authentication, expanded APIs, caching, additional data services, or alternate deployment infrastructure should be treated as proposals until explicitly approved and documented.
