# Task 016 — Contact page that emails kopanalys@gmail.com via Resend

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

No contact page exists. Product requirement: a `/contact` page with a form that actually
delivers the message to **kopanalys@gmail.com** (note: this is different from
`contact@kopanalys.se` used elsewhere in `/terms` and `/privacy` — that's intentional per
the product owner, don't "fix" it to match, they're deliberately different addresses for
different purposes). Decision already made by the product owner: use
**Resend** (resend.com) as the email-sending provider — a `RESEND_API_KEY` environment
variable will be configured by a human separately; you're writing code that reads it from
`process.env`, not obtaining the key yourself.

## Goal

### 1. Add the `resend` npm package

Add `resend` (the official npm SDK) as a dependency in `frontend/package.json` — this one
warrants the new dependency (unlike task 014's chatbot, which deliberately avoided one)
since Resend's SDK is the standard, well-maintained way to use this service and a raw
fetch would mean reimplementing their request-signing/response-handling for no benefit.

### 2. `frontend/src/app/api/contact/route.ts`

- `POST` handler, `runtime = "nodejs"`.
- Body: `{ name: string; email: string; message: string }` — validate all three are
  non-empty strings and `email` looks like a plausible email address (basic regex is
  fine, don't over-engineer RFC-5322 validation).
- Reads `RESEND_API_KEY` from `process.env`. If unset, return a clear
  `503 { error: { code: "contact_unavailable", message: "..." } }`.
- Uses the Resend SDK to send an email:
  - `to: "kopanalys@gmail.com"`
  - `from`: a Resend-verified sending address — since no domain is verified with Resend
    yet, use Resend's default sandbox sender (`onboarding@resend.dev`) for now and note
    in your summary that this should be swapped for a verified `@kopanalys.se` address
    once the domain is verified with Resend (a human/DNS step, out of scope here).
  - `reply_to`: the visitor's submitted email, so replying to the notification email
    goes straight to the visitor.
  - Subject: something like `Nytt meddelande från kopanalys.se — <name>`.
  - Body: the visitor's name, email, and message, plainly formatted.
- Return `200 { success: true }` on success, or a clear error response if Resend's API
  call fails (log the actual error server-side via `console.error`, don't leak Resend
  internals to the client response).

### 3. `frontend/src/app/contact/page.tsx`

- A simple, clean contact page matching the site's existing visual style (dark
  background, green accents — check `frontend/src/components/AuthModal.tsx` for the
  existing form input/button styling conventions and reuse them rather than inventing
  new ones).
- Form fields: name, email, message (textarea). Submit button, loading state, success
  message, and a graceful error message for the `contact_unavailable` case (e.g. "Kontakt
  via formulär är inte tillgänglig just nu — mejla oss direkt på kopanalys@gmail.com
  istället" with a `mailto:` fallback link).
- On success, clear the form and show a confirmation message inline (no page reload
  needed).

## Definition of done

- `/contact` is a real, reachable page with a working form UI.
- Submitting calls `/api/contact`, which — once `RESEND_API_KEY` is configured by a human
  — actually delivers mail to kopanalys@gmail.com with reply-to set to the visitor.
- Without `RESEND_API_KEY` configured (the likely current state), the form fails
  gracefully with the fallback message rather than a raw error or crash.
- `npm run build` passes in `frontend/`.
- Final summary: confirm the sandbox sender address used and that it needs to become a
  verified `@kopanalys.se` address later, plus that `RESEND_API_KEY` needs to be set in
  Vercel for this to actually send mail (human action, out of scope here).
