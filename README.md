# EverGreen Estates

## Overview

EverGreen Estates is a full-stack real estate web application built with Next.js, TypeScript, Supabase, Tailwind CSS, shadcn/ui, Framer Motion, Hugeicons, and Embla Carousel.

The project uses the Next.js App Router, Server Components for data fetching and rendering, and focused Client Components for browser interactivity. Users can browse property listings, view property details, search listings, and filter properties through URL-based search parameters connected to server-side Supabase queries.

## Live Demo Link

[Visit site](https://evergreen-estates.netlify.app/)

![Evergreen Estates Homepage](./dev-images/Screenshot%202026-06-28%20134531.png)

![Async UI State Pattern (Loading, Error, Empty, Success)](./dev-images/Screenshot%202026-06-28%20132230.png)

## Features

- Responsive mobile-first design
- Property browsing and listing pages
- Property media galleries using Supabase Storage
- Two media categories: images and videos
- JPG, JPEG, PNG, WebP, AVIF, and GIF media use Next.js `<Image>`
- MP4 and WebM media use native `<video controls>`
- Server-side search and URL-driven filtering
- Shareable filtered URLs
- Featured property listings
- Loading, error, and data components
- Responsive component-based UI
- Accessibility and SEO considerations
- Server-side data fetching with async Server Components
- Tailwind CSS and shadcn/ui styling

## Media and Image Delivery

Listing media is stored in Supabase Storage and resolved to signed URLs by the server-side database layer.

The application intentionally keeps only two media categories:

```text
JPG / JPEG / PNG / WebP / AVIF / GIF → image
MP4 / WebM                           → video
```

GIF remains an image category and is rendered through Next.js `<Image>`.

Production uses a custom Next.js image loader at `src/lib/netlifyImageLoader.ts`. It generates Netlify Image CDN requests under `/.netlify/images`. The Supabase remote host is allowlisted in `netlify.toml` so Netlify can optimize those remote images.

Local development intentionally bypasses that Netlify-only optimization endpoint. `next.config.ts` sets `images.unoptimized` to `true` when `NODE_ENV` is `development`, so `npm run dev` loads the original Supabase image URL instead of requesting `/.netlify/images` from the local Next.js server.

This keeps development and production functional without introducing a second image service locally.

## Technologies Used

### Frontend

- Next.js 16.x (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Embla Carousel
- Hugeicons

### Backend / Database

- Supabase
  - PostgreSQL database
  - Storage bucket for property media
  - Supabase client integration

### Deployment

- Netlify
- Next.js Runtime
- Netlify Image CDN for production image optimization

### Development Tools

- Git
- GitHub
- VS Code
- ESLint
- npm

## Repository

[View Repository](https://github.com/BryanReyes-dev/evergreen-estates)

## Agent Files

The `agent-files/` directory contains documentation for AI coding agents. `AGENTS.md` contains agent operating instructions, `Agents_Context.md` stores short-term working context, and `CLAUDE.md` is the Claude entry point.

There is exactly one architecture document: `agent-files/ARCHITECTURE.md`. It is the authoritative record of finalized project architecture.

## Project Architecture

The application separates route/page composition, reusable UI, database operations, and shared utilities. Database-related logic is isolated in `src/db`.

Server Components handle property-data fetching and rendering by default. Client Components are used for browser-specific behavior such as interactive filtering, navigation state, animation, and Embla carousel interaction.

Property filtering is URL-driven: filter controls update search parameters, Next.js renders the server-side result, and Supabase supplies the filtered data.

For the complete finalized architecture, see `agent-files/ARCHITECTURE.md`.

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

Build the application:

```bash
npm run build
```

Run the production build locally:

```bash
npm start
```

## Client Components

The application intentionally minimizes Client Components. Components remain Server Components unless browser APIs, React state, event handlers, client-side navigation, animation, or other interactive browser behavior is required.

### `Filters.tsx`

Location: `src/components/Filters.tsx`

`Filters.tsx` manages interactive filtering controls and updates URL search parameters. It does not fetch property data directly.

### `Layout/Menu.tsx`

Location: `src/components/Layout/Menu.tsx`

`Menu.tsx` uses client state, events, and Framer Motion for mobile navigation.

### `ListingMediaCarousel.tsx`

Location: `src/components/ListingMediaCarousel.tsx`

`ListingMediaCarousel.tsx` is a Client Component because Embla Carousel requires browser-side interaction.

## Challenges & Lessons Learned

- Understanding Next.js data-fetching strategies and Server Component boundaries
- Structuring a full-stack Next.js application with separation between UI, database logic, and utilities
- Integrating Supabase PostgreSQL and Storage
- Using URL search parameters as persistent and shareable filter state
- Building reusable media components for image and video listings
- Debugging TypeScript, image optimization, environment variables, and deployment differences between local development and Netlify production
- Handling expiring Supabase signed media URLs safely in server-rendered pages

## Author

Bryan Reyes
