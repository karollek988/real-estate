# Task 014 — Simple FAQ chatbot (OpenAI-backed, floating widget)

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

Product requirement: a simple chat widget that can answer visitor questions about
analysis pricing, how to run an analysis, available payment methods, and what an
analysis is for. Decision (product owner left this to your judgement, already made): use
an API call to a hosted model rather than self-hosting a local model — self-hosting adds
real infra (GPU/CPU capacity, model serving) for no benefit at this scale, whereas a
hosted API call is simple, cheap for this traffic volume, and this codebase already
references `OPENAI_API_KEY` elsewhere (`analysis_engine/narrator/openai_provider.py` on
the Python side), so reuse that same provider rather than introducing a second one.

## Goal

### 1. `frontend/src/app/api/chat/route.ts` — server-side chat endpoint

- `POST` handler, `runtime = "nodejs"`.
- Body: `{ messages: { role: "user" | "assistant"; content: string }[] }` (the running
  conversation so far).
- Reads `OPENAI_API_KEY` from `process.env`. If unset, return a clear
  `503 { error: { code: "chat_unavailable", message: "..." } }` rather than crashing —
  this key may not be configured in every environment yet.
- Calls OpenAI's Chat Completions REST API directly via plain `fetch` (do **not** add the
  `openai` npm package as a new frontend dependency just for this — a single `fetch` to
  `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer <key>` is all
  that's needed and keeps the dependency footprint down). Use model `gpt-4o-mini`
  (cheap, fast, sufficient for FAQ-style answers), `temperature` around 0.3.
- System prompt must ground the assistant strictly in accurate, current facts about this
  product — pull the real numbers/facts from the codebase rather than inventing them:
  - Free tier: 3 free analyses (`supabase/migrations/20260723000300_quota_defaults.sql`).
  - Premium pricing/payment: Stripe, one-time purchase or subscription — check
    `frontend/src/lib/stripe/prices.ts` for the real price keys/tiers.
  - What an analysis covers, and the free-vs-premium content difference — check
    `deepseek-tasks/completed/006-shorten-free-report.md`.
  - Non-advisory positioning: the assistant must NEVER give a purchase recommendation or
    tell a user whether to buy a specific property — it can explain what the *product*
    does, not evaluate a *specific listing* itself (it has no access to analysis data).
    If asked to evaluate a specific property, it should redirect the user to run an
    actual analysis instead.
  - If asked something outside this product's scope (general legal/financial advice,
    unrelated topics), it should politely decline and suggest contacting
    contact@kopanalys.se instead.
  - Keep responses short (2-4 sentences) — this is a widget, not a long-form chat.
- Reuse the FAQ content from task 012 (`frontend/src/components/sections/FaqSection.tsx`)
  as source material for the system prompt where relevant, rather than duplicating facts
  that might drift out of sync — either import the `FAQ_ITEMS` array and serialize it
  into the prompt, or summarize its content directly in the prompt string; your choice,
  but keep it factually aligned with that file.

### 2. `frontend/src/components/ChatWidget.tsx` — floating chat widget

- A small floating button (bottom-right corner, avoid colliding with
  `CookieSettingsLink.tsx`'s bottom-left position) that expands into a chat panel on
  click.
- Simple UI: message list (user messages right-aligned, assistant left-aligned, matching
  the site's dark/green visual language), a text input + send button, loading state
  while awaiting a response.
- Client-side conversation state only (no need to persist chat history to a database for
  this task — keep it in `useState`, cleared on page reload).
- Calls `POST /api/chat` with the running message list, appends the response.
- Handle the `chat_unavailable` (no API key configured) case gracefully: show a message
  like "Chatten är inte tillgänglig just nu — kontakta oss på contact@kopanalys.se
  istället." rather than a raw error.

### 3. Mount it

Render `<ChatWidget />` once, site-wide, in `frontend/src/app/layout.tsx` (same pattern
as `CookieConsentBanner`/`CookieSettingsLink` already mounted there).

## Definition of done

- Widget renders on every page, doesn't visually collide with the cookie-settings button.
- With no `OPENAI_API_KEY` set (the likely state until a human configures it), the widget
  degrades gracefully with the fallback message above rather than erroring or crashing.
- `npm run build` passes in `frontend/`.
- Final summary: confirm no new npm dependency was added for this, and that
  `OPENAI_API_KEY` needs to be set in Vercel for the chatbot to actually respond (a human
  action, out of scope for this task).
