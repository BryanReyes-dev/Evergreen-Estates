# EverGreen Estates

## Overview

EverGreen Estates is a full-stack real estate web application built with Next.js, TypeScript, Supabase, Tailwind CSS, shadcn/ui, and Framer Motion.

The project uses the Next.js App Router, Server Components for data fetching and rendering, and focused Client Components for browser interactivity. Users can browse property listings, view property details, search listings, and filter properties through URL-based search parameters connected to server-side Supabase queries.

## Live Demo Link

[Visit site](https://evergreenestates.netlify.app/)

![Evergreen Estates Homepage](./dev-images/Screenshot%202026-06-28%20134531.png)

![Async UI State Pattern (Loading, Error, Empty, Success)](./dev-images/Screenshot%202026-06-28%20132230.png)

## Features

- Responsive mobile-first design
- Property browsing and listing pages
- Property image galleries using Supabase Storage with Next.js optimization
- Server-side search and client-side filtering using URL search parameters
- Shareable filtered URLs
- Clear Filter button that pushes to URL and UI
- Featured property listings
- Loading, error, and data components
- Layout folder structure
- Form validation and accessibility considerations
- SEO optimization
- Reusable component-based architecture
- Cloud image storage management with security implementations
- Server-side data fetching with async Server Components
- Client-side interactive filter UI using search params
- Component styling using Tailwind CSS and shadcn/ui

## Technologies Used

### Frontend

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

### Backend / Database

- Supabase
  - PostgreSQL database
  - Storage buckets for property images
  - Supabase client integration

### Deployment

- Netlify
- Next.js Runtime

## Development Tools

- Git
- GitHub
- VS Code
- ESLint
- npm

## Repository

[View Repository](https://github.com/BryanReyes-dev/evergreen-estates)

## Agent Files

The `agent-files/` directory contains documentation for AI coding agents and is separate from this human-facing README and the application source. `AGENTS.md` contains agent instructions, `ARCHITECTURE.md` records finalized architecture, `Agents_Context.md` stores short-term working context, and `CLAUDE.md` provides the Claude entry point.

## Project Architecture

The application separates UI components, database logic, and shared utilities. Database-related logic is isolated in `src/db`, while the Next.js App Router provides the route and rendering layer. Server Components handle data fetching and rendering by default; Client Components are used where browser state, event handlers, navigation hooks, or other interactive behavior is required.

## Installation Steps

Clone the repository:

```bash
git clone https://github.com/BryanReyes-dev/evergreen-estates.git
```

Navigate into the project:

```bash
cd evergreen-estates
```

Install dependencies:

```bash
npm install
```

Create environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Run the development server:

```bash
npm run dev
```

Open the development URL reported by Next.js.

## Challenges & Lessons Learned

- Understanding Next.js data fetching strategies and when to use Server Components versus Client Components
- Structuring a full-stack Next.js application with separation between UI components, database logic, and utility functions
- Integrating Supabase as a backend solution, including database tables, storage buckets, file paths, and production data management
- Understanding URL search parameters as persistent and shareable filtering systems
- Designing reusable components with Tailwind CSS and shadcn/ui
- Debugging TypeScript, environment variable, image optimization, and deployment issues
- Understanding production considerations such as caching, performance, scalability, and hosting configuration

## Client Components

The application intentionally minimizes Client Components. Components remain Server Components unless they require browser APIs, React state, event handlers, client-side navigation hooks, or other interactive browser behavior.

### `Filters.tsx`

Location: `src/components/Filters.tsx`

`Filters.tsx` is a Client Component because it contains interactive filtering controls and updates URL search parameters. It does not fetch property data directly; the Server Component layer performs the database query after the URL changes.

### `Layout/Menu.tsx`

Location: `src/components/Layout/Menu.tsx`

`Menu.tsx` is a Client Component because mobile navigation uses React state, click events, and Framer Motion animations.

## shadcn/ui Client Components

The following UI components include `"use client"`:

```text
src/components/ui/checkbox.tsx
src/components/ui/field.tsx
src/components/ui/label.tsx
src/components/ui/separator.tsx
```

## Author

Bryan Reyes
