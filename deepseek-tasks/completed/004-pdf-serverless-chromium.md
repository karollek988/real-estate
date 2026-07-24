# Task 004 — Fix PDF generation on Vercel (Puppeteer serverless incompatibility)

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/app/api/analyses/[id]/pdf/route.ts` generates a PDF report using the full
`puppeteer` package, which expects a locally-downloaded Chrome binary cached on disk. This
works in local development but fails on Vercel's serverless functions with:

```
Error: Could not find Chrome (ver. 150.0.7871.24). This can occur if either
1. you did not perform an installation before running the script (e.g. `npx puppeteer
browsers install chrome`) or 2. your cache path is incorrectly configured (which is:
/home/sbx_user1051/.cache/puppeteer).
```

Confirmed live in production via Vercel runtime logs on 2026-07-24.

## Goal

Replace `puppeteer` with `puppeteer-core` + `@sparticuz/chromium` (the standard combination
for running headless Chrome on Vercel/AWS Lambda serverless functions), which bundles a
serverless-compatible Chromium binary instead of expecting a locally cached download.

1. In `frontend/package.json`:
   - Remove `puppeteer` from dependencies.
   - Add `puppeteer-core` and `@sparticuz/chromium` (use current stable versions
     compatible with each other — check their READMEs/changelogs for version pairing
     notes, since `@sparticuz/chromium` major versions are tied to specific
     `puppeteer-core` major versions).

2. In `frontend/src/app/api/analyses/[id]/pdf/route.ts`:
   - Replace `import puppeteer from "puppeteer"` with
     `import puppeteer from "puppeteer-core"` and `import chromium from "@sparticuz/chromium"`.
   - Change the `puppeteer.launch(...)` call to use `chromium`'s executable path and
     recommended launch args, e.g. (adapt to the actual current API — check the
     `@sparticuz/chromium` README for the exact current usage, APIs have changed
     between major versions):
     ```ts
     browser = await puppeteer.launch({
       args: chromium.args,
       executablePath: await chromium.executablePath(),
       headless: true,
     });
     ```
   - Keep everything else in the route (auth check, cookie forwarding, PDF options,
     error handling) exactly as-is — only the browser launch mechanism changes.

3. Add `export const maxDuration = 60;` near the top of the route file (next to
   `export const runtime = "nodejs";`) — headless Chrome + page render + PDF export can
   take longer than Next.js/Vercel's default function timeout, and this is the standard
   way to raise it for an individual App Router route.

4. Locally, `npm run build` won't actually exercise the Chromium download/launch path
   (that only happens at runtime), so also do a static check: confirm the import syntax
   is correct and there are no leftover references to the old `puppeteer` package
   anywhere else in the codebase (`grep -r "from \"puppeteer\"" frontend/src`).

5. Do not change how the PDF's content/layout is generated (the `page.pdf(...)` options,
   the animation-disabling style tag, the report URL construction) — this task is only
   about making headless Chrome launch successfully in the serverless environment.

## Definition of done

- `puppeteer` removed from `package.json`; `puppeteer-core` + `@sparticuz/chromium` added.
- The route uses `chromium.executablePath()` / `chromium.args` for the launch config.
- `maxDuration = 60` exported from the route.
- `npm run build` passes in `frontend/`.
- No remaining imports of the plain `puppeteer` package anywhere in `frontend/src`.
- Final summary: exact package versions used, and an honest note that this can only be
  fully verified by an actual deploy + PDF download attempt (which the human will do),
  since a local build can't reproduce Vercel's serverless filesystem.
