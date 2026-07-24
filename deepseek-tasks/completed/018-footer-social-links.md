# Task 018 — Facebook and Instagram links in the footer

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/components/SiteFooter.tsx` has no social media links. Add these two exact
URLs (do not modify them, do not guess a shorter/cleaner-looking variant):
- Facebook: `https://www.facebook.com/profile.php?id=61592039229644&locale=sv_SE`
- Instagram: `https://www.instagram.com/kopanalys/`

## Goal

Add a small row of social icon links to `SiteFooter.tsx`, placed in the bottom bar
alongside the existing copyright text and "Cookie-inställningar" link (check
`CookieSettingsLinkInline.tsx`'s usage there for the current bottom-bar layout — fit
these in without breaking that existing flex layout, e.g. as a third item in the same
flex row, wrapping gracefully on narrow screens like the rest of that bar already does).

- Use simple inline SVG icons for Facebook and Instagram (check
  `frontend/src/components/icons.tsx` for whether icons for these already exist there —
  if not, add two small new icon components there following the exact pattern of the
  existing icons in that file: `viewBox="0 0 24 24"`, same prop spreading convention,
  don't invent a different icon-authoring style).
- Both links: `target="_blank" rel="noopener noreferrer"`, and an `aria-label`
  ("Köpanalys på Facebook" / "Köpanalys på Instagram") since they're icon-only links.
- Match the existing muted-neutral hover-to-green-accent color convention already used
  for other footer links.

## Definition of done

- Facebook and Instagram icon links appear in the footer bottom bar, using the exact
  URLs given above, opening in a new tab, with proper `aria-label`s.
- `npm run build` passes in `frontend/`.
- Final summary: whether new icons were added to `icons.tsx` or reused from elsewhere.
