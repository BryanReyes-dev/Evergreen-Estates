# EverGreen Estates

## Overview:
Evergreen estates is a fictional real estate web application designed to demonstrate a responsive, mobile-first user experience for browsing property listings. Built with typescript, react incorporating API data fetching.

## Live Demo Link:
[Visit site](https://evergreenestates.netlify.app/)

![Evergreen Estates Homepage](./dev-images/Screenshot%202026-06-28%20134531.png)


![Async UI State Pattern (Loading, Error, Empty, Success)](./dev-images/Screenshot%202026-06-28%20132230.png)

## Features:
- Responsive mobile-first design
- Integrated third-party real estate API via RapidAPIwith [motion](https://motion.dev/)
- Property browsing with search and filtering
- Featured property listings
- Dynamic property detail pages
- Property image galleries
- Favorites / saved properties system
- User authentication (login, signup, logout)
- User profile dashboard
- Booking / viewing request flow (UI simulation)
- Loading and error handling for data fetching
- Form validation and accessibility support
- SEO-friendly page structure
- Reusable component-based architecture
- Real estate data integration via REST API (or mock data)
- Client-side filtering and search
- Protected routes for authenticated users
- Contact form


## Technologies Used:
- Next.js
- React
- TypeScript
- Tailwind CSS
- Motion


## Development Tools:
- Git
- GitHub
- VS Code
- ESLint

## Repository:
[View Repository](https://github.com/Dimethyl-tryptamine/Portfolio-Website)


## Future Improvments:

- impement a code distribution tool 
(shadcn/ui)
- Full backend integration with database ([Supabase](https://supabase.com/) or [Firebase](https://firebase.google.com/))
- Real authentication with persistent sessions
- Payment / booking system simulation (Stripe-style flow)
- Map integration for property locations
- Improved caching and performance optimization
- Admin dashboard for managing listings
- Deployment optimization (SEO + performance tuning)


## Installation Steps:
 Clone the repository:
```bash
   git clone https://Dimethyl-tryptamine/evergreen-estates.git
```

2. Navigate into the project:
```bash
   cd evergreen-estates
   cd my-app
```

3. Install dependencies:
```bash
   npm install
```

4. Run the development server:
```bash
   npm run dev
```

5. Open in browser:
The terminal will show the correct local URL (usually http://localhost:3000)

# Challenges & Lessons Learned:
- Handling data fetching 
- Learning how to design reusable UI components
- Understanding tradeoffs between mock data and real API integration
- Improving responsiveness and UI consistency across devices
- async server components 


## Client Components
-By default, Next.js renders components on the server to improve initial page load speed and SEO. 

The following components require `"use client"` because they depend on browser-only APIs or 
React hooks that cannot run on the server.

**`CheckBox.tsx`**
Uses an `onChange` event handler to respond to user interaction. Event listeners are browser-only and cannot be attached during server-side rendering.

**`Menu.tsx`**
Uses `useState` to track whether the mobile overlay is open or closed, and Framer Motion's `AnimatePresence` to animate it in and out. Both require a live browser environment to respond to user actions and manage animation state.

**`Listing.tsx`**
Uses `useState` and `useEffect` to fetch property listings after the component mounts. `useEffect` is client-only — data fetching that depends on the component lifecycle cannot happen on the server in this pattern.

**`search/page.tsx`**
Uses `useState` to manage filter state, `useRef` to access price input values directly, and renders `CheckBox` and `Menu` which are already client components. Any page that uses hooks or renders client components must itself be marked as a client component.

##Search & Filtering System

This project includes a client-side filtering system for property listings built with React state management.

### Features
- Filter by price range (min/max)
- Filter by property features (tags like Garage, Pool, Fireplace, etc.)

### How it works
- Filter state is managed in the parent `Search` component using `useState`
- Checkbox components update shared state using lifted state callbacks
- Listings are dynamically filtered using `.filter()` before rendering

### Key Concept
This project demonstrates **lifting state up** in React to centralize filtering logic while keeping UI components reusable and focused on presentation.

[checkbox props and system implementation](./dev-images/Screenshot%202026-06-30%20150120.png)


## Author  
- Bryan Reyes 
