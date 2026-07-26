
## 🔴 Critical

1. **`Saved/page.tsx` — missing `return`** — the JSX `<>saved page</>` is written but never returned, the component renders nothing and silently fails

2. **`Menu.tsx` — non-camelCase SVG attributes** — several SVGs use `stroke-width`, `stroke-linecap`, `stroke-linejoin` instead of React's required `strokeWidth`, `strokeLinecap`, `strokeLinejoin`, causing React warnings and potential render issues

3. **`Listing.tsx` — `text-black` on dark background** — the description has `text-black` but sits on `bg-[#3A3F42]`, the text is invisible

4. **`Listing.tsx` — type mismatch on error state** — state is typed `string | null` but you set it with `setError("")` instead of `setError(null)`, inconsistent with your own type

5. **`Search/page.tsx` — double range input is broken** — two `<input type="range">` overlaid with `z-index` will conflict and fight each other for pointer events, it doesn't work as a dual slider

6. **`Search/page.tsx` — filters are never applied** — `handleClick` only `console.log`s, the filter state is built up but never actually used to filter anything

7. **`Menu.tsx` — no keyboard accessibility** — the hamburger toggle is a plain `<div onClick>` with no `role="button"`, no `aria-label`, no `onKeyDown`, completely inaccessible to keyboard and screen reader users

8. **`Nav.tsx` — unused import** — imports both `Link` and `link` (lowercase) from `next/link`, the lowercase one is unused and will cause lint errors

9. **`globals.css` — global checkbox styles** — the `input[type="checkbox"]` rule affects every checkbox in the entire app, not just your custom `CheckBox` component, any third party or future checkbox will inherit these styles unexpectedly

10. **Folder is named `componenets`** — seen in `Search/page.tsx` imports, it's a typo that will cause build failures if anything references the correct spelling

---

## 🟡 Medium 

1. **`layout.tsx` — metadata title is still `"Create Next App"`** — should be `"EverGreen Estates"`, this shows in browser tabs and is bad for SEO

2. **`Header.tsx` — mixing inline styles with Tailwind** — `textShadow` and color are in `style={{}}` while everything else is Tailwind, pick one approach and stick to it

3. **`Nav.tsx` — heart and profile icons are not interactive** — they look like buttons but are bare SVGs with no `<button>` or `<Link>` wrapper, users can't click them

4. **`Menu.tsx` — clicking outside the overlay doesn't close it** — only the X button closes it, standard UX expectation is clicking the backdrop also closes it

5. **`Listing.tsx` — `setListings([])` inside try is unnecessary** — state is already initialised as `[]` and there's a single fetch, resetting it mid-function adds noise

6. **`Search/page.tsx` — `useRef` and `useState` mixed for inputs** — price inputs use `useRef` while everything else uses `useState`, pick one pattern, `useState` is the React way

7. **`FeaturedCommunities.tsx` — no error boundary** — if `Listing` throws, the entire page crashes with no fallback UI

8. **`Profile/page.tsx` and `Saved/page.tsx` are skeleton pages** — fine for now but they export components with no real structure, worth at least adding a layout placeholder

9. **`Menu.tsx` and `Nav.tsx` duplicate the same nav items** — Find Homes, Saved Homes, Profile exist in both components as hardcoded JSX, if you add a new route you have to update two places

10. **`<img>` used everywhere instead of Next.js `<Image>`** — you lose automatic lazy loading, responsive sizing, and format optimisation that Next.js provides for free

---

## 🟢 Improvements 

1. **Extract a `useFeaturedListings` custom hook** — the `useEffect` + `useState` fetch logic in `Listing.tsx` should live in its own hook file, this is a standard pattern senior devs expect to see

2. **Create a `ListingCard` component** — the card JSX inside `.map()` should be its own component, smaller focused components are much easier to test and reuse

3. **Move colours to Tailwind config** — `#228100`, `#202324`, `#3A3F42` are scattered across every file, define them once in `tailwind.config.js` as named colours like `brand-green` and `brand-dark`

4. **Add loading skeletons** — replace `<div>loading...</div>` with a skeleton that mirrors the card layout, this is the industry standard and is what interviewers look for

5. **Add a `types.ts` file** — `Houselisting` is imported from `SiteData`, type definitions should live in a dedicated `types/index.ts` file that's imported wherever needed

6. **Break `Search/page.tsx` into smaller components** — `FilterPanel`, `PriceRangeSlider`, and `SearchResults` should each be their own component, the current file is doing too much

7. **Add `aria-label` to icon-only buttons** — SVG icons used as interactive elements need descriptive labels for screen readers, e.g. `aria-label="Open menu"`

8. **Use `next/image` `<Image>` component** — swap all `<img>` tags, it shows you know Next.js properly and is something interviewers specifically check for

9. **Add an `.env.local` for data source URL** — even with local data, structuring it so the source is an env variable shows you understand the pattern for when it becomes a real API

10. **Add JSDoc comments to your components** — a one-line comment above each component describing what it does and what props it takes signals professional habits and makes codebases much easier to work in as a team