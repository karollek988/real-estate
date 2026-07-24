# Task 013 — Add "Startsida" to the header nav, next to "Så fungerar det"

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/components/SiteHeader.tsx` has a `NAV_ITEMS` array (around line 18):
```ts
const NAV_ITEMS: { label: string; action: NavAction }[] = [
  { label: "Så fungerar det", action: { type: "modal" } },
  { label: "Exempelrapport", action: { type: "scroll", targetId: "marknadsinsikter" } },
  { label: "Priser", action: { type: "scroll", targetId: "analyze" } },
  { label: "FAQ", action: { type: "scroll", targetId: "faq" } },
];
```
Product requirement: add a "Startsida" (Home) link **immediately before** "Så fungerar
det" (i.e. as the new first item).

## Goal

Add `{ label: "Startsida", action: { type: "link", href: "/" } }` as the first entry in
`NAV_ITEMS` (the `NavLink` component in the same file already handles `{ type: "link" }`
actions via `<Link href={action.href}>` — reuse that, don't add new logic). Do not
reorder or modify the other existing items.

## Definition of done

- "Startsida" appears first in the header nav, linking to `/`.
- The other three nav items are unchanged in order and behavior.
- `npm run build` passes in `frontend/`.
- Final summary: one line confirming the array change.
