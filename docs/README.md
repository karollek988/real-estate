# Köpanalys documentation

**Current truth first, history second, procedures on demand.** Every kind of information has one primary home; when
you change something, change it there and link to it from elsewhere instead of copying it.

## Where each kind of information lives

| Kind of information | Primary source |
|---|---|
| Instructions for Claude Code (every session) | [`/CLAUDE.md`](../CLAUDE.md) |
| Rules for specific folders (loaded when Claude works on those files) | [`/.claude/rules/`](../.claude/rules/) — `frontend.md`, `report-objectivity.md`, `python-engine.md`, `supabase.md` |
| Step-by-step procedures (loaded when needed) | [`/.claude/skills/`](../.claude/skills/) — `verify`, `deploy-check`, `prod-db-readonly` |
| Current status, known issues, next steps | [`/PROJECT_STATE.md`](../PROJECT_STATE.md) |
| How the system is built | [`architecture/overview.md`](architecture/overview.md) |
| What is sold, the report, product rules | [`product/overview.md`](product/overview.md) |
| Environments, deploys, environment variable names | [`operations/environments.md`](operations/environments.md) |
| Database rules and production migration status | [`operations/database.md`](operations/database.md) |
| Decisions and why | [`decisions/README.md`](decisions/README.md) |
| Branches, pull requests, CI, what never to commit | [`/CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Languages and visible text | [`/frontend/src/i18n/README.md`](../frontend/src/i18n/README.md) |
| Frontend commands and layout | [`/frontend/README.md`](../frontend/README.md) |
| Python engine routes, local run, translation model | [`/api/README.md`](../api/README.md) |
| Annual-report extractor | [`/BRF-Scraper/README.md`](../BRF-Scraper/README.md) |
| Location engine | [`/src/location_intelligence/README.md`](../src/location_intelligence/README.md) |
| Names and meaning of every environment variable | [`/frontend/.env.example`](../frontend/.env.example), [`/api/.env.example`](../api/.env.example) |
| GitHub branch rules (importable) | [`/.github/rulesets/README.md`](../.github/rulesets/README.md) |
| Background research | [`research/`](research/) |
| Superseded and historical material | [`archive/`](archive/README.md) |
| Design references (images) | [`design/`](design/) — referenced from code comments; `screenshots/landing-page.png` is a July 2026 screenshot |

Internal team matters (roles, budget, deadlines, server plans) are not kept here: the repository is public.

## Documents still in this folder's root

These are **not** current documentation. They stay at their paths because code comments link to them by path; moving
them means updating those comments (a separate change). Each has a `STATUS` banner at the top.

| File | Status | Cited by |
|---|---|---|
| `48_brf_review_and_deck_alignment_2026-10-02.md` | **Partly current** — §1 BRF review flow and runbook, §3 benchmarks with sources | `lib/brf/interpret.ts`, `lib/report/housingCost.ts` |
| `legal-data-migration-plan.md` | **Open draft** — replacing Hemnet scraping | `providers/registry.ts`, `providers/parseBotBooli.ts` |
| `28_free_data_providers.md` | Reference — provider conventions | `src/location_intelligence/*`, `tests/location_intelligence/*` |
| `36`–`40` (location engine research, design, plan, future development, validation) | Reference / historical | `src/location_intelligence/*`, its README |
| `data-sources.md`, `data-source-inventory.md` | Research (July 2026) | provider and market-stats comments, `frontend/.env.example` |
| `44_production_release_checklist.md` | Historical (2026-07-20) | `api/server.py`, location/market providers |
| `22_user_input_flow.md`, `25_analysis_pipeline.md` | Historical | `listing/classify.ts`, `normalize.ts` |
| `34_brf_registry_architecture.md` | Archived (never built) | `src/location_intelligence/models.py` |
| `architecture.md` | Archived (July 2026 monorepo plan) | root `pyproject.toml` |

`kopanalys-engine-map.pdf` in this folder is an untracked local file and is deliberately not committed.

## Research (`research/`)

Background studies from July–September 2026 — users' problems, Booli alternatives, a competitor gap analysis, open-source
reuse, price and civic data sources. Useful context, not a description of the current product.

## Writing documentation

- Update the primary source; don't add a second copy elsewhere.
- No dated session logs in current documents — `PROJECT_STATE.md` says what is true now, `decisions/README.md` why.
- Never document secret values, and don't invent facts: write **UNKNOWN** or **REQUIRES REVIEW** instead.
- When a document stops being true, move it to `archive/` with a `STATUS: ARCHIVED` banner and a reason (if code links
  to it, leave it in place with the banner).
