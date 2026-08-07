# EverGreen Estates

## Overview


EverGreen Estates is a full-stack real estate web application built with Next.js, TypeScript, Supabase, Tailwind CSS, and shadcn/ui.

The project demonstrates a modern Next.js App Router architecture using Server Components for data fetching and rendering, while isolating interactive behavior into small Client Components where browser functionality is required.

The application allows users to browse property listings, view property details, search listings, and filter properties using URL-based search parameters connected to server-side Supabase queries.


## Live Demo Link

[Visit site](https://evergreenestates.netlify.app/)

![Evergreen Estates Homepage](./dev-images/Screenshot%202026-06-28%20134531.png)

![Async UI State Pattern (Loading, Error, Empty, Success)](./dev-images/Screenshot%202026-06-28%20132230.png)


# Features

- Responsive mobile-first design
- Property browsing and listing pages
- Property image galleries using Supabase Storage with next.js optimization
- Server side Search and client side filtering system using URL search parameters
- Shareable filtered URLs
- Clear Filter button that pushes to url and ui
- Featured property listings
- Loading, error, and data components
- layout folder structure
- Form validation and accessibility considerations
- SEO optimization 
- Reusable component-based architecture
- Cloud image storage management with security implementations
- Server-side data fetching with async Server Components
- Client-side interactive filter ui using search params
- Component styling using Tailwind CSS and shadcn/ui


# Technologies Used

## Frontend

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

## Backend / Database

- Supabase
  - PostgreSQL database
  - Storage buckets for property images
  - Supabase client integration

## Deployment

- Netlify
- Next.js Runtime


# Development Tools

- Git
- GitHub
- VS Code
- ESLint
- npm


# Repository

[View Repository](https://github.com/BryanReyes-dev/Portfolio-Website)


# Project Architecture

The application follows a separation between UI components, database logic, and utility functions.

Example structure:
```
src/
├── app/
│ ├── (site)/
├ └── page.tsx
│
├── components/
│ ├── ui/
│ ├── Layout/
│ ├── Filters.tsx
│ ├── CheckBox.tsx
│ └── listing components...
│
├── db/
│ └── supabase/
│ ├── queries
│ ├── utilities
│ └── database helpers...
│
└── lib/
└── shared utilities...
```
The application separates:

- UI components
- Database operations
- Shared utility functions
- Server-side data fetching

Database-related logic is isolated inside the `db` directory to keep database operations separate from presentation components.


# Installation Steps

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

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

Run the development server:

```bash

npm run dev
```

Open:
```bash
http://localhost:3000
```
# Next.js Architecture

EverGreen Estates uses the Next.js App Router architecture.

## Server Components

Server Components are used by default throughout the application.

They are responsible for:

- Fetching property data
- Calling Supabase queries
- Rendering listing results
- Handling server-side search parameters
- Reducing unnecessary client-side JavaScript

The search page uses async Server Components to receive URL parameters and request filtered data from Supabase.

Example flow:
```
User changes filters
|
v
Filters Client Component updates URL parameters
|
v
Search page receives updated parameters
|
v
Server Component queries Supabase
|
v
Filtered listings are rendered
```

# Challenges & Lessons Learned

- Understanding Next.js data fetching strategies and when to use Server Components versus Client Components
- Learning how async Server Components simplify data fetching compared to traditional client-side fetching patterns
- Minimizing Client Components by delegating interactive behavior into isolated Client Components while keeping data fetching and rendering responsibilities inside Server Components
- Structuring a full-stack Next.js application with separation between UI components, database logic, and utility functions
- Integrating Supabase as a backend solution, including database tables, storage buckets, file paths, and production data management
- Understanding the tradeoffs between client-side filtering, server-side filtering, and database queries
- Managing state and data flow between components while avoiding unnecessary prop drilling 
- Learning how URL search parameters can create persistent and shareable filtering systems 
- Designing reusable components and understanding how component libraries like shadcn/ui are structured
- Learning when components require `"use client"` and when they can remain server-rendered
- Debugging TypeScript issues across database queries, components, and application logic
- Understanding environment variables and how they differ between local development and production deployments
- Learning how cloud storage systems work, including bucket structure, file paths, and public asset delivery
- Migrating property images from local assets to Supabase Storage and understanding cloud-based image delivery
- Troubleshooting Next.js image optimization issues when deploying to a hosting provider
- Understanding how hosting environments can affect framework features such as Next.js image optimization and runtime behavior
- Learning how deployment configurations differ between local development and production environments
- Debugging Netlify deployment issues involving publish directories, build configuration, and framework plugins
- Improving responsive layouts and UI consistency using Tailwind CSS
- Learning how component libraries like shadcn/ui improve development speed while maintaining customization
- Understanding production considerations such as caching, performance optimization, scalability, and deployment configuration
- Learning the importance of testing application behavior in production environments rather than relying only on local development


# Client Components

The application intentionally minimizes Client Components.

By default, components remain Server Components unless they require:

- Browser APIs
- React state
- Event handlers
- Client-side navigation hooks
- Interactive UI behavior

The following components require `"use client"`:



## `Filters.tsx`

Location: ```src/components/Filters.tsx```

`Filters.tsx` requires `"use client"` because it contains interactive filtering controls.

It uses:

- `useState`
- `useEffect`
- `useRouter`
- `usePathname`
- `useSearchParams`

The component handles:

- Search input updates
- Price slider changes
- Tag selection
- Updating URL search parameters

The component does not fetch property data directly.

Instead, it updates the URL and allows the Server Component layer to perform the database query.

This keeps filtering logic server-driven while maintaining a responsive user interface.

---

## `Layout/Menu.tsx`

Location:```src/components/Layout/Menu.tsx```

`Menu.tsx` requires `"use client"` because mobile navigation depends on interactive browser behavior.

It uses:

- React state for opening and closing the menu
- User click events
- Framer Motion animations

The rest of the layout remains server-rendered.

---

# shadcn/ui Client Components

The following UI components include `"use client"`:
```
src/components/ui/checkbox.tsx
src/components/ui/field.tsx
src/components/ui/label.tsx
src/components/ui/separator.tsx
```





# Author

Bryan Reyes


