# Task 011 — Profile dropdown menu with logout and a new "Sekretess" page

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/components/SiteHeader.tsx` has a `UserAvatarButton` component (the round
initials avatar shown top-right when logged in) that currently just navigates straight to
`/dashboard` on click — there is no dropdown and, critically, **no visible way to log
out anywhere on the site**. Sign-out already exists as a working function
(`useAuth().signOut()` from `frontend/src/lib/auth/AuthProvider.tsx`, currently only
wired up inside `frontend/src/app/dashboard/settings/page.tsx` around line 234) — you're
exposing it, not building it.

Existing routes to link to (do not invent new ones for these):
- `/dashboard` — already shows the user's analyses ("mina analyser")
- `/dashboard/settings` — account settings (check this file — it may already contain
  personal-info fields; if "Om mig" and "Inställningar" turn out to be the same content,
  it's fine for both dropdown items to point at the same page, or to link to two anchored
  sections within it if the page already has that structure. Use your judgement and
  state which you chose in the summary.)
- `/dashboard/inspection` — Besiktningshjälp

## Goal

### 1. Turn the avatar into a dropdown trigger

In `SiteHeader.tsx`, replace `UserAvatarButton`'s plain navigate-on-click with a dropdown
menu (click to open/close, close on outside click and on Escape — check if this codebase
already has a dropdown/menu pattern elsewhere to reuse before inventing one; if not, a
simple `useState` + conditional render + a `mousedown` document listener is fine, this
doesn't need a UI library). Menu items, in this order:

1. Mina analyser → `/dashboard`
2. Inställningar → `/dashboard/settings`
3. Om mig → (see note above)
4. Besiktningshjälp → `/dashboard/inspection`
5. Sekretess → `/dashboard/privacy` (new page, see step 2 below)
6. A visual divider, then **Logga ut** — calls `useAuth().signOut()`, then redirects to
   `/` (home). Style this item distinctly (e.g. a subtle red/warning tint on hover) since
   it's a destructive/session-ending action, matching whatever danger-state color
   convention this codebase already uses elsewhere (check for existing red/warning
   button styles before inventing a color).

Match the existing dark-theme/green-accent visual language used throughout
`SiteHeader.tsx` and `AuthModal.tsx` — rounded corners, subtle borders, the same font
sizes as other nav items.

### 2. New page: `frontend/src/app/dashboard/privacy/page.tsx` ("Sekretess")

This is **not** a duplicate of the legal `/privacy` policy page — it's an
account-specific, friendly summary of what data this specific logged-in user has given
Köpanalys and what happens to it. Content:

- A short intro linking to the full legal policy: "Se vår fullständiga
  [integritetspolicy](/privacy) för mer detaljer."
- **Dina kontouppgifter**: what's stored about them personally — name (if provided),
  email, account creation date. Fetch this from wherever the settings page already gets
  profile data (check `frontend/src/app/api/profile/route.ts` /
  `frontend/src/lib/analysis/ownership.ts`'s `getProfileSummary` — reuse existing data
  fetching rather than inventing a new endpoint if one already returns what's needed).
- **Dina analyser**: a short explanation that analysis requests (which properties they
  looked up, when) are linked to their account so they can see their own history on
  `/dashboard`, and that the underlying property analysis data itself is shared/cached
  across users (not personal to them) — see the docstring in
  `frontend/src/lib/analysis/ownership.ts` for the accurate technical framing, and phrase
  this in plain, non-technical Swedish for an end user.
- **Vad vi INTE gör**: reassurance that analysis/account data is not sold to third
  parties (consistent with `/privacy`'s existing "Vi säljer inte din data" language —
  don't contradict it).
- A link/button to open the cookie settings (reuse
  `frontend/src/lib/consent.ts`'s `reopenCookieConsent()` — see how
  `frontend/src/components/CookieSettingsLink.tsx` already calls it, follow that exact
  pattern here too, don't invent a second mechanism).

## Definition of done

- Clicking the avatar opens a dropdown with all 6 items listed above, in that order.
- "Logga ut" actually signs the user out (verify by checking it calls the existing
  `signOut()` and redirects home) — this is the core bug being fixed, get it right.
- `/dashboard/privacy` is a real page reachable from the dropdown, with the content
  described above, reusing existing data-fetching where it already exists rather than
  duplicating it.
- `npm run build` passes in `frontend/`.
- Final summary: which routes "Om mig" and "Inställningar" ended up pointing at and why.
