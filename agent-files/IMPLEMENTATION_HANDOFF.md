# Implementation handoff — 2026-10-21

## Scope of this branch

Branch: \`feature/ui-workflows-and-populate-fix\`

This branch connects existing Next.js user-facing pages to the authentication, seller-profile, listing, review, and media APIs. It also fixes dry-run credential handling in the population script and refreshes project documentation.

Automated test expansion, the final security audit, and Vite+ work remain deferred to the next work session. No live database or Storage writes were run.

## Implemented in source

- Added a shared client-side API helper that normalizes the API's current error response styles without surfacing unexpected server exceptions.
- Added email/password sign-up and sign-in forms using the existing Better Auth React client, plus session-aware account navigation and sign-out.
- Replaced the mobile menu with a responsive accessible navigation panel, keyboard Escape dismissal, focus-loop handling, and touch-sized controls.
- Added seller-profile create/read/update/delete forms with validation for display name, bio length, HTTP(S) avatar URLs, email/phone formats, and the required preferred-contact detail.
- Replaced the profile placeholder with a protected seller page listing only the signed-in seller's listings, plus links to view, edit, and manage media.
- Added a public seller storefront at \`/sellers/[sellerId]\`. It returns only published profiles, lists their properties, and exposes only the seller's explicitly supplied contact details—not the private login email.
- Added shared listing create/edit forms, a server-scoped edit route, and confirmed listing deletion. The existing API/database remain responsible for owner authorization, seller-profile eligibility, and the three-listing cap.
- Added review creation and author-only edit/delete controls using the existing review APIs. Added meaningful empty-review and unrated states.
- Retained the existing listing media manager/upload helper; added owner controls beside the listing details.
- Replaced the Saved page placeholder with an honest unavailable-state page. Saved homes remain intentionally unimplemented because the repository has no saved-homes persistence/API model.
- Added \`npm run populate\` and \`npm run populate:dry-run\`, pinning the \`tsx@4.20.6\` runner through \`npx\`.
- Corrected population preflight so dry-run does not read the private seller credentials file. Credentials are read only on apply mode after the live preflight and explicit apply safety gate.
- Made the unresolved migration 0011 checksum/provenance issue a hard apply blocker instead of a log-only warning.
- Updated README, agent context, architecture, and this handoff document so code presence, verified behavior, and deferred work are distinct.

## Libraries and implementation choices

No additional runtime form or validation library was introduced. The UI uses the existing Better Auth client, Button/Input primitives, native controls, the project's existing API routes, and owner-scoped Drizzle transaction helper. This keeps the dependency surface small before the planned toolchain work.

The pinned runner is downloaded by \`npx\` on first use if it is not already cached; that can require network access.

## Known blockers and limitations

- The source changes have not been run through TypeScript, ESLint, a production build, automated tests, or browser-level end-to-end checks in this pass. Do not treat the branch as validated before those checks.
- The population dry-run has not been executed. Run \`npm run populate:dry-run\` and inspect its report. It is intended to remain read-only and independent of the seller password file.
- Apply mode remains intentionally blocked until the previously observed checksum/provenance discrepancy for \`drizzle/0011_shared_read_role.sql\` is reconciled. The script's independent live catalog checks do not resolve historical provenance. Do not bypass the code guard, edit the old migration, or alter the Drizzle migration ledger as a shortcut.
- A prior read-only audit saw one existing fixture Storage ETag mismatch. An ETag mismatch alone does not establish different file bytes. The population script downloads expected existing objects for byte comparison; resolve any actual conflict without overwriting it.
- The known existing unrelated Storage objects must be preserved. Population must not delete unknown objects or non-fixture rows.
- \`seed/credentials\` must remain local/ignored. Never commit synthetic passwords or env secrets.
- Saved homes is not implemented. The UI explicitly says saving is unavailable; the feature needs a persistence/API design before it can be added.
- Seller listing-card rating aggregates are not implemented; listing detail calculates an average from loaded reviews.
- A published seller storefront is implemented and uses the shared read role/row-level policy to restrict public visibility to profiles with \`is_published = true\`. Verify publication and privacy behavior manually before enabling it in a live environment.

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
- [ ] Check mobile widths and keyboard-only navigation, focus movement, Escape dismissal, validation states, and pending states.
- [ ] Run \`npm run populate:dry-run\`; confirm exact target project, role/RLS/trigger checks, expected fixture counts, Storage byte comparisons, no need for passwords during dry-run, and no writes.
- [ ] Do not run apply mode until migration 0011 provenance and any genuine Storage byte conflicts have been resolved.

## Deferred until after Vite+ tomorrow

- Expand automated coverage for UI components, Route Handlers, auth/ownership boundaries, database roles/RLS, the media lifecycle, population safeguards, and browser-level workflows.
- Complete the final security audit and resolve findings.
- Re-check package scripts and build/runtime behavior after the selected Vite+ approach. Preserve Next.js as the application runtime unless a deliberate framework conversion is explicitly chosen.
