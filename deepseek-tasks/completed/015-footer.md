# Task 015 — Professional site footer

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

The site has no footer anywhere. Product requirement: a well-organized, professional
footer matching the site's existing visual style (check `frontend/src/app/page.tsx` and
`frontend/src/components/SiteHeader.tsx` for the established dark background / green
accent / typography conventions — don't invent a new visual style).

## Goal

1. `frontend/src/components/SiteFooter.tsx` — a footer with clearly organized columns
   (standard pattern: logo/tagline column + 2-3 link columns + bottom bar), containing:
   - **Brand column**: Köpanalys logo/name (reuse whatever logo asset/mark
     `SiteHeader.tsx` uses — don't introduce a new logo) and a one-line tagline
     consistent with the homepage's existing positioning copy.
   - **Produkt** column: links to the same in-page sections `SiteHeader.tsx`'s
     `NAV_ITEMS` already scroll to (Så fungerar det / Exempelrapport / Priser / FAQ) plus
     "Startsida" (`/`) from task 013 — reuse those same target ids/behavior rather than
     re-implementing scroll logic; if reusing the scroll-to-section function isn't
     practical from a server-rendered footer, plain anchor links (`/#faq` etc.) landing
     on the same sections are an acceptable simpler alternative — your call, note which
     you chose.
   - **Företag** column: links to `/terms`, `/privacy`, `/contact` (the contact page from
     task 016 — check `deepseek-tasks/completed/` for whether it exists yet; link to
     `/contact` regardless, it'll resolve once that task lands).
   - **Bottom bar**: © with the current year (computed via `new Date().getFullYear()`,
     not a hardcoded year) and "Köpanalys" / org.nr 9811048793, plus the same
     "Cookie-inställningar" control pattern already used elsewhere
     (`frontend/src/components/CookieSettingsLink.tsx`'s `reopenCookieConsent()` — you
     can either link/reference that existing floating button or add an inline text link
     in the footer that calls the same function; avoid building a third separate consent
     mechanism).
2. Mount `<SiteFooter />` at the bottom of the homepage (`frontend/src/app/page.tsx`) —
   check whether other top-level pages (`/terms`, `/privacy`, `/contact` once it exists)
   should also get it for consistency; if easy to do without restructuring layout.tsx
   significantly, prefer including it in `frontend/src/app/layout.tsx` instead so it's
   site-wide automatically — your call based on what's cleaner given the existing layout
   structure, explain your choice in the summary.

## Definition of done

- Footer renders with the sections described, visually consistent with the rest of the
  site (dark background, green accents, correct spacing/typography scale).
- Copyright year is computed, not hardcoded.
- `npm run build` passes in `frontend/`.
- Final summary: where you mounted it (layout.tsx site-wide vs per-page) and why, plus
  confirmation of which cookie-settings link pattern you reused.
