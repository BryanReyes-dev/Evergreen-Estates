# Implementation handoff — 2026-10-22

## Scope of this branch

Branch: `feature/ui-workflows-and-populate-fix`

This branch connects existing Next.js user-facing pages to the authentication, seller-profile, listing, review, and media APIs. It also fixes dry-run credential handling in the population script and refreshes project documentation.

Saved-homes migration 0019 has been applied to the configured Evergreen Estates Supabase project and its column, CHECK constraint, owner policies, role grants, and listing-delete trigger were verified with read-only catalog checks. No fixture/user/auth/Storage population writes were run. Automated test expansion and the final security audit remain deferred until after Vite+.

## Implemented in source

- Added a shared client-side API helper that normalizes the API's current error response styles without surfacing unexpected server exceptions.
- Added email/password sign-up and sign-in forms using the existing Better Auth React client, plus session-aware account navigation and sign-out.
- Replaced the mobile menu with a responsive accessible navigation panel, keyboard Escape dismissal, focus-loop handling, and touch-sized controls.
- Added seller-profile create/read/update/delete forms with validation for display name, bio length, HTTP(S) avatar URLs, email/phone formats, and the required preferred-contact detail.
- Replaced the profile placeholder with a protected seller page listing only the signed-in seller's listings, plus links to view, edit, and manage media.
- Added a public seller storefront at `/sellers/[sellerId]`. It returns only published profiles, lists their properties, and exposes only the seller's explicitly supplied contact details—not the private login email.
- Added shared listing create/edit forms, a server-scoped edit route with a separate service-error state, and confirmed listing deletion. Aligned the listing PATCH route's server-side constraints with the create endpoint and form (title, price, beds/baths/sqft, address, description, and tags). The existing API/database remain responsible for owner authorization, seller-profile eligibility, and the three-listing cap.
- Added review creation and author-only edit/delete controls using the existing review APIs. Added meaningful empty-review and unrated states.
- Retained the existing listing media manager/upload helper; added owner controls beside the listing details.
- Implemented saved homes in source: migration 0019 adds `users.saved_listings uuid[]` with a 100-item CHECK constraint, owner-only SELECT/UPDATE policies including a restrictive SELECT clamp, explicit Better Auth grants, GET/PATCH `/api/v1/users/me/saved-listings`, account-scoped client saved state that ignores stale responses across account switches, card/detail save controls, a functional Saved homes page, and a listing-delete cleanup trigger.
- Added `npm run populate` and `npm run populate:dry-run`, pinning the `tsx@4.20.6` runner through `npx`.
- Corrected population preflight so dry-run does not read the private seller credentials file. Credentials are read only on apply mode after the live preflight and explicit apply safety gate.
- Made the unresolved migration 0011 checksum/provenance issue a hard apply blocker instead of a log-only warning.
- Corrected duplicate declarations found during source inspection in the population preflight script.
- Updated README, agent context, architecture, and this handoff document so code presence, verified behavior, and deferred work are distinct.

## Libraries and implementation choices

No additional runtime form or validation library was introduced. The UI uses the existing Better Auth client, Button/Input primitives, native controls, the project's existing API routes, and owner-scoped Drizzle transaction helper. This keeps the dependency surface small before the planned toolchain work.

The pinned runner is downloaded by `npx` on first use if it is not already cached; that can require network access.

## Known blockers and limitations

- The source changes have not been run through TypeScript, ESLint, a production build, automated tests, or browser-level end-to-end checks in this pass. Do not treat the branch as validated before those checks.
- The population dry-run has not been executed. Run `npm run populate:dry-run` and inspect its report. It is intended to remain read-only and independent of the seller password file.
- Apply mode remains intentionally blocked until the provenance discrepancy for `drizzle/0011_shared_read_role.sql` is reconciled. Git history does not contain the version that produced the live 0011 checksum, so current catalog similarity alone is not proof of provenance. Do not bypass the code guard, edit the old migration, or rewrite the existing 0011 ledger row. The new 0019 entry tracks the migration that was actually applied.
- A prior read-only audit saw one existing fixture Storage ETag mismatch. An ETag mismatch alone does not establish different file bytes. The population script downloads expected existing objects for byte comparison; resolve any actual conflict without overwriting it.
- The known existing unrelated Storage objects must be preserved. Population must not delete unknown objects or non-fixture rows.
- `seed/credentials` must remain local/ignored. Never commit synthetic passwords or env secrets.
- Migration 0019 has been applied and registered in the Drizzle migration ledger. Saved-home source is still not browser-verified.
- Seller listing-card rating aggregates are not implemented; listing detail calculates an average from loaded reviews.
- A published seller storefront is implemented and uses the shared read role/row-level policy to restrict public visibility to profiles with `is_published = true`. Verify publication and privacy behavior manually before enabling it in a live environment.

## Static review and manual verification checklist before Vite+

- [ ] Run TypeScript check, ESLint, and the Next.js production build.
- [ ] Create a fresh synthetic test account, verify redirect/session state, sign in again, and sign out.
- [ ] Create and edit a seller profile with email preference; verify missing/invalid contact data fails.
- [ ] Create and edit a seller profile with phone preference; verify changing preference requires the matching contact value.
- [ ] Test profile deletion with no listings and with existing listings (the latter should be rejected).
- [ ] Publish a profile and open its public storefront; unpublish it and confirm it becomes unavailable to anonymous/public reads.
- [ ] Confirm the storefront does not expose the Better Auth login email, sessions, or other private auth data.
- [ ] Create a listing; exercise invalid title/price/beds/baths/square-feet/address/description/tags, missing seller profile, and the three-listing cap.
- [ ] Edit and delete an owned listing. Verify another account cannot edit or delete it, and confirm media-cleanup error handling.
- [ ] Upload an image, GIF, and video; verify progress, signed media display, reorder order, deletion, and 50,000,000-byte validation.
- [ ] Create a review; attempt a duplicate; edit/delete the author's own review; confirm another account does not get the controls and the server rejects unauthorized mutations.
- [ ] Save/unsave from listing cards and details; verify persistence after refresh and a new sign-in.
- [ ] Verify anonymous, empty, populated, and error states on Saved homes and the 100-item cap.
- [ ] Delete a listing and confirm the trigger removes the deleted ID from saved arrays.
- [ ] Check mobile widths and keyboard-only navigation, focus movement, Escape dismissal, validation states, and pending states.
- [x] Apply migration 0019 and verify its column, CHECK constraint, owner policies, grants, and listing-delete cleanup trigger through catalog checks.
- [ ] Run `npm run populate:dry-run` against the configured project; confirm the saved-list contract checks and read-only behavior.
- [ ] Do not run apply mode until migration 0011 provenance and any genuine Storage byte conflicts have been resolved.

## Deferred until after Vite+ tomorrow

- Expand automated coverage for UI components, Route Handlers, auth/ownership boundaries, database roles/RLS, the media lifecycle, population safeguards, and browser-level workflows.
- Complete the final security audit and resolve findings.
- Re-check package scripts and build/runtime behavior after the selected Vite+ approach. Preserve Next.js as the application runtime unless a deliberate framework conversion is explicitly chosen.
