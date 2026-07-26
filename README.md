# EverGreen Estates

## Overview

Evergreen Estates is a fictional real estate web application built to demonstrate a modern full-stack Next.js application architecture. The project focuses on creating a responsive, mobile-first experience for browsing property listings while implementing real-world concepts such as database integration, cloud storage, dynamic routing, filtering systems, and component-driven UI development.

Built with Next.js, TypeScript, React, Tailwind CSS, Supabase, and shadcn/ui.

## Live Demo Link

[Visit site](https://evergreenestates.netlify.app/)

![Evergreen Estates Homepage](./dev-images/Screenshot%202026-06-28%20134531.png)

![Async UI State Pattern (Loading, Error, Empty, Success)](./dev-images/Screenshot%202026-06-28%20132230.png)


# Features

- Responsive mobile-first design
- Property browsing and listing pages
- Dynamic property detail routes
- Property image galleries using Supabase Storage
- Search and filtering system using URL search parameters
- Shareable filtered URLs
- Featured property listings
- Favorites / saved properties system
- User profile interface
- Authentication UI flow
- Booking / viewing request UI simulation
- Loading, error, and empty states
- Form validation and accessibility considerations
- SEO-friendly page structure
- Reusable component-based architecture
- Database-backed property data using Supabase
- Cloud image storage management
- Server-side data fetching with async Server Components
- Client-side interactive components where required
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

[View Repository](https://github.com/Dimethyl-tryptamine/Portfolio-Website)


# Project Architecture

The application follows a separation between UI components, database logic, and utility functions.

Example structure:
```
src/
├── app/
│ ├── (site)/
│ ├── api/
│ └── globals.css
│
├── components/
│ ├── ui/
│ └── reusable components
│
├── db/
│ ├── supabase/
│ └── database utilities
│
└── lib/
└── shared utilities
```

Database-related logic is isolated inside the `db` directory to keep database operations separate from presentation components.


# Future Improvements

- Implement real authentication with persistent sessions
- Add protected routes
- Build admin dashboard for managing listings
- Add property management CRUD operations
- Add map integration for property locations
- Implement booking workflow with backend persistence
- Add payment simulation using Stripe-style architecture
- Improve caching strategies
- Add automated testing
- Add performance monitoring and optimization
- Improve image optimization strategy with production CDN configuration
- Add analytics and user behavior tracking


# Installation Steps

Clone the repository:

```bash
git clone https://github.com/Dimethyl-tryptamine/evergreen-estates.git
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

# Challenges & Lessons Learned

- Understanding Next.js data fetching strategies and when to use Server Components versus Client Components
- Learning how async Server Components simplify data fetching compared to traditional client-side fetching patterns
- Structuring a full-stack Next.js application with separation between UI components, database logic, and utility functions
- Integrating Supabase as a backend solution, including database tables, storage buckets, file paths, and production data management
- Migrating from mock data to real database-backed data
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
- Understanding how environment variables need to be configured for production deployments
- Improving responsive layouts and UI consistency using Tailwind CSS
- Learning how component libraries like shadcn/ui improve development speed while maintaining customization
- Understanding production considerations such as caching, performance optimization, scalability, and deployment configuration
- Learning the importance of testing application behavior in production environments rather than relying only on local development


# Client Components

By default, Next.js renders components on the server to improve initial page performance, SEO, and reduce unnecessary client-side JavaScript.

The following components require `"use client"` because they depend on browser interactions, React state, or event handling.


## `Menu.tsx`

Uses `"use client"` because it manages interactive mobile navigation state.

The component uses `useState` to control whether the mobile navigation overlay is open or closed.

It also uses Framer Motion's `AnimatePresence` to animate the menu entering and leaving the page.

These features require client-side JavaScript because they depend on user interaction and browser events.


## `Filters.tsx`

Uses `"use client"` because it contains interactive filtering controls that respond to user input.

The component listens for user interactions and updates URL search parameters when filters change. This allows filter selections to persist in the URL, making search results shareable and allowing users to return to the same filtered view.

The filtering interface runs on the client because it relies on browser events and user interaction. The search page can then use the updated search parameters inside a Server Component to fetch and render the appropriate listings.

This approach avoids unnecessary global state while keeping the application aligned with Next.js server-first architecture.


# Search & Filtering System

Evergreen Estates includes a property filtering system powered by URL search parameters.

## Features

- Filter properties by minimum and maximum price
- Filter properties by features and tags
- Search through property listings
- Persist filter selections through URL parameters
- Create shareable filtered search pages


## How It Works

1. The user interacts with the filter controls.
2. `Filters.tsx` updates the URL search parameters.
3. The search page receives the updated parameters.
4. Server Components use those parameters to determine what listings should be fetched.
5. Supabase queries return the matching property data.
6. The page renders the filtered results server-side.


This approach allows filtering state to persist without requiring complex client-side state management while taking advantage of Next.js Server Components.


# Database Architecture

Evergreen Estates separates database-related logic from UI components.

Database functionality is organized inside the `db` directory to keep data operations isolated from presentation logic.

Example:

```
src/
├── db/
│   └── supabase/
│       ├── queries/
│       ├── util/
│       └── client configuration
```

The database layer is responsible for:

- Fetching property listings
- Retrieving individual listings
- Handling Supabase interactions
- Managing database-related utility functions
- Keeping data access logic separate from components


This separation improves maintainability and makes it easier to change database providers or expand backend functionality in the future.


# Supabase Integration

Supabase is used as the backend platform for Evergreen Estates.

The application uses:

- PostgreSQL database for property listing data
- Supabase Storage for property images
- Supabase client libraries for database communication


The project moved from static mock data to real database-backed data, requiring consideration of:

- Database structure
- Query organization
- Storage bucket organization
- Public asset URLs
- Environment variable management
- Production deployment configuration


# Image Storage & Optimization

Property images are stored using Supabase Storage instead of being bundled with the application.

The application retrieves image URLs from Supabase Storage and uses them when rendering property listings.

During deployment, image optimization required additional investigation because Next.js image optimization and Netlify's image handling interact differently than local development.

This introduced lessons around:

- CDN image delivery
- Runtime image processing
- Hosting provider limitations
- Performance tradeoffs
- Optimized versus unoptimized image delivery


# Deployment Lessons

Deploying Evergreen Estates introduced several production-specific challenges.

Key lessons included:

- Configuring Netlify correctly for a Next.js App Router application
- Understanding how Next.js build output is handled during deployment
- Configuring publish directories correctly
- Managing environment variables between local and production environments
- Debugging production-only build errors
- Understanding Netlify plugins and framework integrations
- Investigating differences between local development behavior and deployed behavior


# Future Improvements

- Implement real authentication with persistent sessions
- Add protected routes
- Build an admin dashboard for managing property listings
- Add full CRUD functionality for listings
- Add property management tools
- Implement booking requests with database persistence
- Add map integration for property locations
- Improve caching strategies
- Add automated testing
- Add performance monitoring using tools such as Lighthouse and Web Vitals
- Improve image optimization and delivery strategies
- Add analytics and user behavior tracking


# Author

Bryan Reyes


