# Task 005 — Diagnose why Hemnet extraction returns empty fields / no images in production

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

In production, analyzing a real Hemnet listing URL produces a report where many fields
are empty and no images appear, even though the same pipeline is expected to extract a
rich data set (price, area, fees, images, amenities, etc.) via
`frontend/src/lib/analysis/listing/hemnetPage.ts`, which runs four extractors
(`hemnetExtract/apollo.ts`, `jsonld.ts`, `semanticHtml.ts`, `regexFallback.ts`) and merges
their results (`hemnetExtract/merge.ts`).

**Known suspect, most likely root cause — do not "fix" this, only confirm/report it:**
Hemnet's Cloudflare protection often returns 403/429/503 to server-side fetches from data
center IPs (like Vercel's). When that happens, `scrapeHemnetPage` in `hemnetPage.ts` is
*supposed* to escalate to a Python-engine browser-fetch bridge
(`PYTHON_ENGINE_API_URL` + `/api/browser-fetch`), but if that environment variable isn't
set to a real, publicly-reachable server (as opposed to `http://127.0.0.1:8000`, a
localhost address that only works during local development), the escalation silently
returns `null` and the whole scrape fails — which would explain empty fields/no images
exactly as described. **This specific possibility (the Python engine not being deployed
publicly) is an infrastructure/deployment decision for a human to make, not something you
can fix by writing code** — do not invent a code workaround for a missing backend
deployment.

## Goal

1. **Add diagnostic logging** (not silent failure) so this can be confirmed from Vercel's
   runtime logs next time someone tries an analysis:
   - In `hemnetPage.ts`'s `fetchDirect`, log (via `console.error` or `console.warn`,
     matching the existing logging style used elsewhere in this codebase) when the
     direct fetch is blocked (403/429/503) or fails at the network level, including the
     actual status code.
   - In `fetchViaBrowserBridge`, log when `PYTHON_ENGINE_API_URL` isn't set at all
     (currently returns `null` silently with zero signal), and log the response status
     if the browser bridge request itself fails or returns `success: false`.
   - In `scrapeHemnetPage`, log which path was used (direct fetch succeeded / escalated
     and succeeded / escalated and failed / no escalation configured) so a human reading
     the logs can immediately tell which of these four cases happened for a given
     analysis attempt.
   - Keep all of this to clear, short log lines — this is for humans reading Vercel logs
     after the fact, not a new logging framework.

2. **Separately, audit the extraction code itself for image-specific bugs**, independent
   of the fetch-blocking question above — i.e. assuming the HTML *was* successfully
   fetched, is there a bug in how images are found/kept?
   - Read `hemnetExtract/apollo.ts`, `jsonld.ts`, `semanticHtml.ts`, and especially
     `hemnetExtract/merge.ts` (since merge logic across 4 sources is a common place for a
     field to get silently dropped — e.g. if merge only keeps the highest-confidence
     source's value for a field and that source didn't populate images, but a
     lower-confidence source did).
   - Look specifically for how each extractor handles image/photo URL fields (field name
     may be `images`, `photos`, `imageUrls`, or similar — check `hemnetExtract/types.ts`
     for the actual field name(s) in `HemnetPageData`/`ExtractionResult`).
   - If you find a genuine bug (e.g. a source that could produce images but the field
     name doesn't match what merge.ts expects, or an early return that skips image
     extraction under some condition), fix it. If you don't find a clear bug and instead
     think the missing images are explained entirely by the fetch-blocking scenario
     above, say so clearly instead of inventing a speculative fix.

3. Do not modify environment variables, deployment config, or anything related to
   actually deploying `api/server.py` — that's explicitly out of scope and a human
   decision.

## Definition of done

- Clear, informative log lines added at each of the decision points listed in step 1.
- A genuine, verified image-extraction bug fixed if one was found in step 2 — or a clear
  statement in the summary that none was found and the Python-engine-not-deployed
  scenario is the more likely explanation.
- `npm run build` passes in `frontend/`.
- Final summary must clearly separate: (a) what you changed for logging, (b) what you
  found (or didn't find) in the extraction/merge logic, and (c) an explicit statement
  that whether `PYTHON_ENGINE_API_URL` points to a real deployed backend is something
  only a human can verify/fix — not resolved by this task.
