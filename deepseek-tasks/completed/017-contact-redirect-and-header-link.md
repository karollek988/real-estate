# Task 017 — Redirect home after contact submit + "Kontakt" header link

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/app/contact/page.tsx` currently shows an inline success message (a
`success` state, around line 11 and the conditional render around line 62) after the
contact form is submitted successfully. Product requirement: after a successful submit,
automatically navigate the visitor back to the homepage (`/`) instead of showing the
inline success state.

Separately, `frontend/src/components/SiteHeader.tsx`'s `NAV_ITEMS` array doesn't have a
link to the contact page at all — add one so visitors can easily reach it.

## Goal

### 1. Redirect after successful contact submission

In `frontend/src/app/contact/page.tsx`, after `setSuccess(true)` currently runs
(inside `handleSubmit`, in the success branch), instead redirect to `/` shortly after
showing a brief confirmation — a short delay (e.g. 1.5–2 seconds) so the visitor sees
confirmation their message sent before being navigated away, rather than an instant jump
that could feel like nothing happened. Use `next/navigation`'s `useRouter` (this is
already a `"use client"` component) — `router.push("/")` after a `setTimeout`, clearing
the timeout on unmount to avoid a redirect firing after the component is gone.

Keep the existing inline "Meddelande skickat!" confirmation UI for that brief window
before redirecting — don't remove the confirmation, just make it auto-advance home
afterward instead of staying on `/contact` indefinitely.

### 2. Add "Kontakt" to the header nav

In `frontend/src/components/SiteHeader.tsx`'s `NAV_ITEMS` array, add
`{ label: "Kontakt", action: { type: "link", href: "/contact" } }` as the last item
(after "FAQ") — the `NavLink` component already handles `{ type: "link" }` actions via
`<Link href={action.href}>`, reuse that, don't add new logic. Don't reorder or remove
any existing items.

## Definition of done

- Submitting the contact form successfully shows the confirmation briefly, then
  navigates to `/` automatically.
- "Kontakt" appears as the last item in the header nav, linking to `/contact`.
- `npm run build` passes in `frontend/`.
- Final summary: the delay duration you chose before redirecting.
