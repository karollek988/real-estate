# Task 009 — Cookie consent banner (accept/decline optional cookies)

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

The site currently has no cookie consent mechanism at all. Product requirement: every
visitor must be asked to accept or decline **optional** cookies/tracking (marketing &
analytics) the first time they visit. **Necessary** cookies/data (auth sessions, things
required for the site to function — e.g. Supabase's own auth cookies) are never gated
behind consent and keep working regardless of the visitor's choice.

No analytics/marketing script exists in the codebase yet (checked
`frontend/src/app/layout.tsx` — nothing there). This task builds the consent
infrastructure now so a future analytics/marketing script has something correct to check
before loading; it does not add any actual tracking script itself.

**Legal requirement, not just UX**: under GDPR, optional/non-essential processing needs
prior opt-in consent — it must default to OFF until the visitor actively accepts, not
default ON until they decline. Build it this way; it also satisfies the product
requirement literally ("Decline all" → no optional collection happens) since nothing
optional is ever collected before an explicit choice either way.

## Goal

1. **`frontend/src/lib/consent.ts`** — a small typed module:
   ```ts
   export interface CookieConsent {
     necessary: true; // always true, not a real choice
     marketing: boolean;
     decidedAt: string; // ISO timestamp
   }
   export function getCookieConsent(): CookieConsent | null; // reads from localStorage, null if no decision made yet
   export function setCookieConsent(marketing: boolean): void; // writes the decision
   ```
   Use `localStorage` (key like `kopanalys_cookie_consent`, JSON-encoded) rather than an
   actual browser cookie for simplicity — this is client-side-only state for now, no
   server needs to read it yet.

2. **`frontend/src/components/CookieConsentBanner.tsx`** (client component):
   - On mount, check `getCookieConsent()`. If a decision already exists, render nothing.
   - If no decision exists, render a banner fixed to the bottom of the viewport (or a
     bottom sheet/modal — match the visual language already used elsewhere on the site:
     dark background, green accent buttons, rounded corners — look at
     `frontend/src/components/AuthModal.tsx` for the existing button/color conventions
     rather than inventing a new style).
   - Copy (in Swedish, matching the site's language): explain that necessary cookies are
     always used, and ask for consent to marketing/analytics cookies. Link the word
     "integritetspolicyn" (or similar) to `/privacy` (the page task 010 creates — if that
     page doesn't exist yet when you check, still add the link; it'll resolve once 010
     lands, check `deepseek-tasks/completed/` for whether 010 already ran).
   - Two buttons: **"Acceptera alla"** (calls `setCookieConsent(true)`) and **"Neka alla"**
     (calls `setCookieConsent(false)`). Both dismiss the banner immediately after storing
     the decision.
   - Do not add a granular "customize categories" UI — out of scope, just the two-button
     accept-all/decline-all pattern as specified.

3. Render `<CookieConsentBanner />` once, site-wide, in `frontend/src/app/layout.tsx` (the
   root layout, so it appears on every route) — check how other global UI (if any) is
   already mounted there and follow the same pattern.

4. This task does not need to gate anything else (no existing scripts to conditionally
   load) — it's the consent-capture mechanism only. A future task can wire an actual
   analytics script to check `getCookieConsent()?.marketing === true` before loading it.

## Definition of done

- First-time visitors (no localStorage entry) see the banner; it never reappears after a
  choice is made (verify by checking localStorage is written correctly for both buttons).
- Necessary functionality (login, etc.) is completely unaffected by either choice —
  nothing about existing auth/session code should be touched by this task.
- `npm run build` passes in `frontend/`.
- Final summary: files created/changed, and confirmation that the default state before
  any interaction is "nothing optional collected."
