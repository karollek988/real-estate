---
name: verify
description: Verify a change in the Köpanalys repository before calling it done or opening a pull request — which checks to run for frontend, report/BRF, Python engine, database and documentation changes, how to run them on this Windows machine, and how to report the result honestly. Use after editing code or docs, when asked "funkar det?", "testa", "verifiera", or before a PR.
---

# Verify a change

Run the checks that cover what you changed, then report them as **PASS** (ran, green), **FAIL** (ran, red — with the
output) or **NOT RUN** (with the reason). Never report a check you did not run.

## 1. Pick the checks

| You changed | Run |
|---|---|
| Anything in `frontend/` | `npm run typecheck`, `npm run i18n:check`, `npm run verify` (all from `frontend/`) |
| Report, BRF, analysis code or report texts | the above + read a sample report: `npx tsx src/lib/report/build.objectivity.verify.mjs --dump <scratch file>` |
| Styles or colours | the above + `npm run colours` |
| UI | the above + look at it in the browser (preview "frontend-dev", port 3001) at ~375 px and ~1440 px; no console errors, no sideways scroll |
| `api/`, `analysis_engine/`, `BRF-Scraper/`, `src/` | `pytest` for the touched package (below) |
| A migration | apply it to the **local** stack (`supabase start`, `supabase migration up --local`) and query the result; never production |
| Docs, `CLAUDE.md`, `.claude/**` only | relative links resolve, every path you mention exists, no secret values, `git diff --stat` shows only intended files |
| `Dockerfile`, `api/requirements.txt` | say that the Railway build cannot be verified locally unless you build the image (`docker build .`, slow) |

CI runs `typecheck`, `i18n:check`, `verify` and `pytest api/tests` on every pull request (`.github/workflows/ci.yml`);
running them locally first saves a red PR.

## 2. Run them on this machine

- Frontend: `cd frontend`. If `node_modules` is missing or `package-lock.json` changed since the last install, run
  `npm ci` first (it only touches `node_modules`). One script only: `npm run verify -- <part of its path>`, e.g.
  `npm run verify -- redact`.
- Python, from the repository root:
  `BRF-Scraper/.venv/Scripts/python.exe -m pytest api/tests -q` (CI), and as relevant
  `… -m pytest analysis_engine/tests -q`, `… -m pytest BRF-Scraper/tests -q` (OCR tests skip without Tesseract).
  Root `tests/` need a path dependency outside this repository: NOT RUN unless that folder exists.
- Git Bash rewrites POSIX paths in `docker run` and `git show <ref>:<path>`: prefix with `MSYS_NO_PATHCONV=1`.

## 3. Known reds and limits (don't misreport them)

- ESLint reports ~12 errors from before CI existed; it is not part of CI. Only judge the files you changed.
- `parseBotCoverage.verify.ts` cannot run outside a request scope (it is `.ts`, so `npm run verify` skips it).
- The PDF download (Puppeteer + `@sparticuz/chromium`) does not run on this Windows host — verify on a Vercel preview, or
  locally with `PDF_CHROME_PATH` set to a Chrome/Edge (`frontend/.env.example`); it proves the route's logic, not Vercel's Chromium.
- E-mails are only sent in production (`BRF_REVIEW_EMAILS=on` sends them from `next dev` to real addresses — don't).
- Anything that needs a logged-in production account cannot be verified by Claude; say so and describe the manual check.

## 4. Report

List each check with PASS / FAIL / NOT RUN, the numbers it printed (e.g. "27 verify scripts, all PASS"), what was
looked at in the browser, and what remains unverified. If something failed that you did not cause, say it was red
before your change and how you know.
