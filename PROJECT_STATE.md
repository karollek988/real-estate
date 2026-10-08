# Köpanalys — project state

> **What is true right now.** Keep this file short and current: when something changes, edit the line instead of
> adding a dated log entry. The full history up to 2026-10-08 is in
> [`docs/archive/project-state-history-2026-10-08.md`](docs/archive/project-state-history-2026-10-08.md); decisions are in
> [`docs/decisions/README.md`](docs/decisions/README.md).

**Last updated:** 2026-10-08 · **Production:** `main` at `a231b74` (PR #5, docs and Claude context only), deployed to
Vercel and Railway on 2026-10-08 (GitHub deployments API).

## What is live

- **Site** in Swedish and English: landing, pricing, how it works, public map (`/karta`, example listings plus listings
  visitors keep in their own browser), Bostadsguiden / Insikter / Nyheter (empty until the team publishes),
  price development, contact, legal pages, cookie consent.
- **Purchase and credits:** Områdesanalys 99 kr, Trygghetspaket 499 kr, Tre bostäder 999 kr via Stripe Checkout;
  discount codes; account dashboard with balance, analyses and inspection guide.
- **Analyses:** input by manual entry or listing screenshots (OCR). The pipeline gathers area, market and listing data
  from the providers in `docs/architecture/overview.md`; the report has no scores or advice; Boendekalkyl is a
  "lanseras inom kort" placeholder; PDF download from the report page.
- **BRF analysis:** person-reviewed within 24 h in `/admin/brf`; key figures are read from the uploaded annual report as
  a prefill; team and customer e-mails via Resend.
- **Content editor** `/admin/content` with picture upload; **admin portal** `admin.kopanalys.se` with visitor/purchase
  statistics and the Markov simulator (model with example numbers until real traffic data exists).
- **Python engine** on Railway: annual-report extraction, OCR, location/market data, sv→en translation, Hemnet
  browser-fetch.
- **CI** on pull requests: types, texts (sv/en), 27 verify scripts, Python API tests.

## Known issues and limits

Items marked **REQUIRES REVIEW** need a decision by Karol (or the owner of the area) before anyone acts.

1. **GitHub branch protection is not active** — the rules API returns no rules for `main` (checked 2026-10-08). The
   rulesets in `.github/rulesets/` must be imported by a repository admin. **REQUIRES REVIEW**
2. **Production migration history is out of sync**, `20261007000000_acquisition_analytics` (source tracking for the
   Markov tab) and `20261008120000_text_translations` (translation cache) are **not applied**. What the translation
   feature does without its cache table in production: UNKNOWN. Details: `docs/operations/database.md`. **REQUIRES REVIEW**
3. **Unverified claim on the landing page** (`frontend/src/i18n/messages/{sv,en}/landing.ts`, shown by
   `components/landing/AnalyzeSection.tsx`): "Betrodd av fastighetsinvesterare över hela Sverige" (no source found).
   **REQUIRES REVIEW** (marketing law risk). The false rating "4.8/5 baserat på 256 omdömen" and its stars were removed
   on 2026-10-08.
4. **Privacy policy inaccuracy:** `legal` messages say OpenAI interprets uploaded BRF annual reports; only the FAQ chat
   uses OpenAI, and the policy does not say that Köpanalys staff read uploaded documents. Legal text — **REQUIRES REVIEW**.
5. **Hemnet scraping is still reachable** (`POST /api/analyses` with a Hemnet URL → Camoufox `/api/browser-fetch`) although
   the UI no longer submits URLs; the plan to replace it (`docs/legal-data-migration-plan.md`) is an open draft.
   **REQUIRES REVIEW**
6. **Booli has no credentials** anywhere known, so sold-price data is missing from the reports.
7. **The 24-hour BRF promise depends on people** watching `/admin/brf`; nothing escalates a late review.
8. **Not verified in production by a logged-in person** (as of the last record, 2026-10-02): a real checkout with the new
   prices, the reviewer flow with e-mails, the PDF download. Status since then: UNKNOWN.
9. **Not verified after the language release:** the Railway build and memory with the translation model, and the
   translator on real articles.
10. New accounts start with 0 credits; how someone can try the product without paying is undecided (2026-10-02).
11. Rate limiting is in memory per server instance, not shared.
12. Not in CI: ESLint (~12 old errors), `npm run colours`, `analysis_engine/tests`, `BRF-Scraper/tests`, root `tests/`
    (needs a path dependency outside this repository).
13. The automatic `brfFinancials` provider still runs when a report is uploaded but nothing customer-facing reads it.
14. Branches that don't follow the naming rule (`styleRedesign`, `mapDemoIntegration`, `backup/main-before-merge-2026-10-07`)
    are kept; delete or rename only with Karol's OK.
15. Vestigial code is listed at the end of `docs/architecture/overview.md` (**REQUIRES REVIEW** before deletion).
16. **The "Supabase Preview" check fails on every push to `main`** since the Supabase GitHub integration was connected
    (first run 2026-10-07 on `bf0562e`): `supabase/config.toml` is rejected because of the send-email hook secret format.
    On pull requests it is skipped. Not caused by any one PR. Details: `docs/operations/database.md`. **REQUIRES REVIEW**

## Ongoing and next

- **Boendekalkyl** (hidden costs per home): start from `lib/report/housingCost.ts`, then set `HOUSING_COST_LIVE = true`.
- Replace the social proof (item 3) and review the legal texts (item 4).
- Apply the missing migrations and repair the migration history — with Karol's OK (item 2).
- Import the GitHub rulesets (item 1).
- Possible later: reuse a published BRF review for other homes in the same association; a reminder before a review is
  late; read the loan notes of an annual report automatically.

Team priorities, deadlines and infrastructure plans are internal and are not kept in this public repository.
