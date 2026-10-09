# Köpanalys — architecture overview

> **STATUS: CURRENT.** Canonical description of how the system is built. Verified against the code on 2026-10-08
> (`origin/main` = `02562b5`). When the code and this file disagree, the code wins — fix this file in the same pull request.

## The system in one picture

```text
 Visitor (kopanalys.se, English under /en)          Admin (admin.kopanalys.se)
          │                                                  │
          ▼                                                  ▼
 ┌──────────────────────── Next.js 16 app — frontend/ — Vercel ─────────────────────────┐
 │ App Router pages (src/app/[locale]/…), API routes (src/app/api/**),                  │
 │ admin portal (Pages Router: src/pages/admin-portal), host/language/session routing   │
 │ in src/proxy.ts                                                                       │
 └───┬───────────┬───────────┬──────────┬──────────────┬───────────────────────┬────────┘
     │           │           │          │              │                       │
 Supabase     Stripe      Resend     OpenAI      Public data APIs        Python engine
 Postgres,   Checkout +   e-mail     FAQ chat    (Nominatim, SCB, OSM,   (HTTPS + header
 Auth,       webhook                 only        Skolverket, Trafiklab,  X-Internal-Secret)
 Storage                                         SMHI, Riksbanken, …)          │
                                                                               ▼
 ┌──────────────── FastAPI engine — api/server.py — Railway (root Dockerfile) ─────────┐
 │ BRF-Scraper/src/brf_scraper/extractor  annual report (PDF/Word/photo) → key figures │
 │ analysis_engine/                       BRF metrics + rule-based findings            │
 │ src/location_intelligence, src/market_intelligence   area and market providers     │
 │ api/translation.py                     Opus-MT sv→en (CTranslate2)                  │
 │ /api/browser-fetch                     Camoufox (Firefox) fetch of a Hemnet page    │
 └─────────────────────────────────────────────────────────────────────────────────────┘
```

## Frontend (`frontend/`)

- **Stack:** Next.js 16.2 (App Router + one Pages Router page), React 19, TypeScript, Sass on one master variables
  file (`src/styles/_variables.scss`, Tailwind 4 `ka-*` colours generated from it), next-intl.
- **Languages:** Swedish (unprefixed, master copy) and English (`/en/…`). All visible text lives in
  `src/i18n/messages/{sv,en}/<area>.ts`. How it works: [`frontend/src/i18n/README.md`](../../frontend/src/i18n/README.md).
- **Public site** (`src/app/[locale]/(site)/`): landing, `priser`, `karta` (public map), `bostadsguider`, `insikter`,
  `nyheter`, `omraden`, `prisutveckling`, `sa-fungerar-det`, `skapa-analys`, `kontakt`.
- **Customer app** (`src/app/[locale]/`): `buy`, `analyzing`, `report` (also printed to PDF), `dashboard/*`
  (balance, inspection guide, coupons, settings, privacy), `privacy`, `terms`, `auth/confirmed`.
- **Two admin areas — do not mix them up:**
  - `kopanalys.se/admin` (`src/app/admin/**`): BRF review console (`/admin/brf`) and content editor
    (`/admin/content`). Normal Supabase login, allowed emails in `KOPANALYS_ADMIN_EMAILS` (`src/lib/auth/admin.ts`).
  - `admin.kopanalys.se` (`src/pages/admin-portal/`): statistics and the Markov simulator (`src/lib/markov/`).
    Its own password login (`ADMIN_PASSWORD_HASH`, HMAC session cookie, `src/lib/admin/`), strict CSP in `next.config.ts`.
- **Public map** (`/karta`, `src/components/map/PublicMap.tsx` mounting `src/components/admin/atlas/atlas.ts`):
  Leaflet on OpenStreetMap tiles and Nominatim. Shows example listings; listings a visitor creates are stored in **that
  visitor's browser (localStorage)**, not on the server.
- **Content** (Bostadsguiden/Insikter/Nyheter, `src/lib/content/`): table `content_items` + public Storage bucket
  `content-images`; written in `/admin/content`.
- **Analytics** (`src/lib/analytics/`): cookieless daily visitor counting (`/api/analytics/hit`) and a consent-only
  source cookie `ka_src` (`/api/analytics/arrival`).

## The analysis flow (what happens when a customer orders a report)

1. **Input** — manual entry or listing screenshots (OCR via the engine's `/api/ocr/extract-text`) from the landing
   form. `POST /api/analyses` still also accepts a Hemnet listing URL (see "Scraping").
2. **Pay** — Stripe Checkout (`src/lib/stripe/`); the webhook grants credits through the RPC
   `grant_purchase_credits`. One credit = one analysis of one property (`full` or `area`).
3. **Pipeline** — `src/lib/analysis/submit.ts` → `pipeline.ts` runs the data providers in waves
   (`providers/registry.ts`; an area analysis runs only the area subset) and stores the result
   (`store.ts`). Analyzers only collect facts (`engine/collectFactors.ts`); there is **no score or verdict**.
4. **Report** — `src/lib/report/build.ts` builds the chapters; `src/app/[locale]/report` renders them;
   `/api/analyses/[id]/pdf` prints the page to PDF (`puppeteer-core` + `@sparticuz/chromium`).
   `src/lib/analysis/redact.ts` limits an area analysis to the area chapter.
5. **BRF chapter** — person-reviewed, not automatic: the annual report is uploaded (by the customer or the team) →
   the engine reads key figures as a **prefill** → a reviewer checks and publishes in `/admin/brf` →
   `src/lib/brf/interpret.ts` turns the figures into plain Swedish. Product rules: [`docs/product/overview.md`](../product/overview.md).

## Data providers (`frontend/src/lib/analysis/providers/`)

| Wave | Provider | Source | Note |
|---|---|---|---|
| 0 | `geocoding` | Nominatim (OSM) | Coordinates and municipality; everything in wave 1 depends on it |
| 0 | `hemnetPage` | Hemnet listing page | Only when a Hemnet URL was submitted; see "Scraping" |
| 0 | `booli` | Booli Listing API | Needs `BOOLI_CALLER_ID`/`BOOLI_API_KEY`; not configured anywhere known → reports `not_connected` |
| 0 | `riksbanken` | Riksbanken | Policy/interest rates |
| 0 | `placeholders` | — | Sources declared but not connected (e.g. Lantmäteriet); shown honestly as missing |
| 1 | `scb`, `osm`, `skolverketSchools`, `commute` (Trafiklab + OSRM), `smhi`, `trafikverket` | Public APIs | Gate on coordinates |
| 1 | `locationIntelligence`, `marketIntelligence` | Python engine | `src/location_intelligence`, `src/market_intelligence` |
| 2 | `brfFinancials` | Python engine | Runs only when an annual report was uploaded; nothing customer-facing reads it now |

`parseBotBooli` exists but is disabled (broken location search, legal flag). `DISABLED_PROVIDERS` switches providers
off without a code change. Other market data for the site (not the report): `src/lib/marketStats/` (SCB house price
index, KPIF, Riksbanken, Svensk Mäklarstatistik pages); news headlines from RSS (`src/lib/news/`).

## Python engine (`api/`, Railway)

Routes and local running: [`api/README.md`](../../api/README.md). Key facts for anyone changing it:

- One service, `kopanalys-python-api`, built from the **root `Dockerfile`** (two stages: translation model, then
  the engine). The image copies **the whole repository** (`COPY . .`), and `api/server.py` imports
  `analysis_engine/`, `BRF-Scraper/src` and `src/` by **adding those folders to `sys.path`**. Moving or renaming
  those folders breaks production.
- Every route except `GET /` requires `X-Internal-Secret` = `PYTHON_ENGINE_API_SECRET` (same value on Vercel and Railway).
- The image contains Tesseract (`swe`, `eng`), Camoufox (Firefox) and the ~75 MB Opus-MT model.
- A GitHub Action (`.github/workflows/restart-python-engine.yml`) redeploys the service daily at 03:00 UTC as a
  memory safety net for Camoufox.

## Scraping — what is still live

- **Automatic BRF annual-report acquisition was removed on 2026-10-02** (git tag `archive/brf-automation-2026-10-02`).
  `BRF-Scraper/` is now only the *extractor* for uploaded reports — the folder name is historical.
- **Hemnet listing pages can still be fetched**: `POST /api/analyses` with a Hemnet `url` → `hemnetPage` provider →
  direct fetch, then Camoufox escalation via the engine's `/api/browser-fetch`. The landing UI no longer submits URLs.
  Legal status: open (`docs/legal-data-migration-plan.md`, draft). **REQUIRES REVIEW** before it is promoted again.

## Database (Supabase)

One Supabase project serves **both Preview and Production**; local development uses `supabase start`
(ports in `supabase/config.toml`, API 54331). Schema is defined only by `supabase/migrations/*`. Migration status,
storage buckets and the rules for touching production: [`docs/operations/database.md`](../operations/database.md).

## Deployment

| What | Where | Trigger |
|---|---|---|
| `frontend/` | Vercel project `real-estate` | Push to `main` → Production (all domains); other branches → Preview |
| Python engine | Railway `kopanalys-python-api` | Push to `main` |
| Database | Supabase | **Manual only** — migrations are never applied by a deploy |
| CI | GitHub Actions `ci.yml` | Pull requests and pushes to `main` |

Environments, domains and environment variables: [`docs/operations/environments.md`](../operations/environments.md).

## Testing

No test framework in the frontend: each `*.verify.mjs` next to the code it checks prints PASS/FAIL
(`npm run verify` runs all of them). Python uses pytest (`api/tests` in CI; `analysis_engine/tests`,
`BRF-Scraper/tests` and root `tests/` are not in CI). How to run everything: the `verify` skill
(`.claude/skills/verify/SKILL.md`) and [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Not part of the running system

- `src/real_estate/` — the original Python skeleton (docstrings only, no code). Still listed in the root `pyproject.toml`, and
  imported by `tests/test_smoke.py`, so removing it means editing both.
- Local, untracked folders: `Future_investment_engine/`, `ai-orchestrator/`, `deepseek-tasks/` (only `__pycache__`).
- The root `pyproject.toml` (Poetry) depends on `../../shared/probability-engine`, a folder outside this repository,
  so the root `tests/` only run on the original monorepo machine.

A search finds no import, build step, Docker step or CI job that uses the first three, but they have not been removed —
**REQUIRES REVIEW** before deletion.
