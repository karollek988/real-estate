# Decision log

> **STATUS: CURRENT.** One line per decision that still shapes the code, newest first, with where the detail lives.
> Add a row when a decision changes how the product or the system works. Superseded decisions stay, marked as such —
> they explain why old documents look the way they do.

| Date | Decision | Detail |
|---|---|---|
| 2026-10-10 | The public map's pins (sale listings, buyer wishes, exchanges) are kept in the database, not in the visitor's browser: signed-in users post, everyone sees them at once, the team can hide one. A sale listing shows the nearest bus stop and train station (facts only) from Transitous, looked up once and stored | `supabase/migrations/20261010020104_map_listings.sql`, `docs/architecture/overview.md` |
| 2026-10-09 | A Trygghetspaket report reaches its customer **only after a reviewer has read and released it** (not just the BRF chapter); the customer sees a waiting page, ready within 24 hours. Områdesanalys stays automatic; reports that already existed stay visible | `docs/product/overview.md`, `supabase/migrations/20261009182000_analysis_release.sql` |
| 2026-10-09 | `main` needs **no approval** to merge: the ruleset asks for 0 approvals, so the author can merge their own pull request. A pull request and the green check CI passed are still required. (GitHub never lets an author approve their own pull request.) | `.github/rulesets/README.md`, `CONTRIBUTING.md` |
| 2026-10-08 | Claude Code context rebuilt: project `CLAUDE.md`, path-scoped rules, skills, canonical docs; history archived | `docs/archive/claude-context-migration-2026-10-08.md` |
| 2026-10-08 | `main` changes only through pull requests from `feature/`, `fix/`, `refactor/` branches with CI and one approval (the approval part was dropped on 2026-10-09, see above). The GitHub ruleset is active (rules API, 2026-10-09) | `CONTRIBUTING.md`, `.github/rulesets/README.md` |
| 2026-10-08 | The site is Swedish (master) and English (`/en`); articles and map listings are machine-translated on our own server (Opus-MT), not by a third party | `frontend/src/i18n/README.md`, `api/README.md` |
| 2026-10-08 | One light cream-and-green palette everywhere; colours only from `_variables.scss` (checked by `npm run colours`) | `CONTRIBUTING.md` |
| 2026-10-08 | The native C++ rewrite of the Python engine is dropped; the engine stays Python | `docs/archive/project-state-history-2026-10-08.md` |
| 2026-10-08 | Repository history cleaned of a receipt and an old admin password; `ADMIN_PASSWORD_HASH` is required, no built-in fallback | `docs/archive/project-state-history-2026-10-08.md` |
| 2026-10-07 | The whole site, including `admin.kopanalys.se`, deploys from `main` only; no domain follows another branch | `docs/operations/environments.md` |
| 2026-10-07 | Legacy Premium/campaign/broker-document database objects and subscription columns removed from production | `docs/operations/database.md` |
| 2026-10-07 | "Blogg/Guider" became Bostadsguiden, Insikter, Nyheter — database-backed and written by the team in `/admin/content` | `docs/product/overview.md` |
| 2026-10-05 | All styles are Sass on one master variables file (`frontend/src/styles/_variables.scss`) | `.claude/rules/frontend.md` |
| 2026-10-02 | **No scores, verdicts or price judgements in the report** — it states facts | `docs/product/overview.md`, `docs/48_brf_review_and_deck_alignment_2026-10-02.md` |
| 2026-10-02 | **The BRF analysis is reviewed by a person within 24 h**; annual reports are uploaded, never fetched automatically (automatic acquisition removed, tag `archive/brf-automation-2026-10-02`) | `docs/48_…` |
| 2026-10-02 | One-time packages Områdesanalys 99 / Trygghetspaket 499 / Tre bostäder 999; Premium, subscriptions, free analyses and the "First 100" campaign removed | `docs/product/overview.md` |
| 2026-10-02 | The price analysis is replaced by a Boendekalkyl (hidden costs); a placeholder until it is built | `docs/product/overview.md` |
| 2026-09 | The Python engine only answers requests carrying the shared secret `PYTHON_ENGINE_API_SECRET` | `api/README.md` |
| 2026-09 | Listing input by screenshot (OCR) and manual entry instead of pasting a Hemnet URL (Cloudflare made scraping unreliable) | `docs/archive/project-state-history-2026-10-08.md` |
| 2026-08-13 | Plan to replace Hemnet scraping with lawful data sources — **draft, still open**; Hemnet fetching is still reachable | `docs/legal-data-migration-plan.md` |
| 2026-07-22 | **The report never recommends or advises** (TS report layer and Python reasoning engine) | `docs/product/overview.md`, `.claude/rules/report-objectivity.md` |
| 2026-07-18 | `BLUEPRINT.md` adopted as the governing pipeline (with a Buy/Avoid decision engine) — **superseded** 2026-10-02 | `docs/archive/BLUEPRINT.md` |
