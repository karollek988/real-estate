# Task 003 — Accessibility pass on dashboard components

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

The dashboard components under `frontend/src/components/dashboard/` (and its `buy/`
subfolder) render the main authenticated user experience: cards, buttons, progress
indicators, icons. A quick accessibility pass here directly improves usability for
keyboard and screen-reader users without any risk to business logic, since it's markup/
attribute changes only.

## Goal

Go through every `.tsx` file directly inside `frontend/src/components/dashboard/` and
`frontend/src/components/dashboard/buy/` (not subfolders beyond that) and fix these
specific issues wherever you find them:

1. **Icon-only buttons or links** (a `<button>` or `<a>` whose only content is an SVG/icon
   component, no visible text) — add an `aria-label` describing the action in Swedish
   (match the language already used in the rest of the UI copy in that file).
2. **Images** (`<img>` tags, or Next.js `<Image>` components) missing an `alt` attribute —
   add a meaningful `alt` describing the image; use `alt=""` only if the image is purely
   decorative and adjacent text already conveys the same info.
3. **Custom clickable `<div>` or `<span>` elements** (has an `onClick` but isn't a real
   `<button>`/`<a>`) — add `role="button"`, `tabIndex={0}`, and a matching `onKeyDown`
   handler that triggers the same action on Enter/Space. If it would be simple and safe to
   just change the element to a real `<button>` instead (no layout-breaking style
   dependency on it being a div), prefer that over adding ARIA attributes.
4. **Form inputs without an associated label** — add a `<label htmlFor="...">` (with a
   matching `id` on the input) or `aria-label` if a visible label would break the existing
   layout.

Do not change component logic, props, or visual layout/styling beyond what's needed for
the accessibility fix itself (e.g. adding a `<label>` might need a small layout tweak —
keep it minimal and consistent with the existing Tailwind classes used nearby).

## Definition of done

- Every icon-only interactive element, missing alt, non-semantic clickable div, and
  unlabeled input in the specified folders is fixed per the rules above.
- `npm run build` passes in `frontend/` at the end (per ground rules).
- Final summary: list of files changed and, per file, a one-line list of what was fixed
  (e.g. "ProfileCard.tsx: added aria-label to edit-icon button, added alt to avatar image").
