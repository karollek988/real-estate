# Claude Code context and documentation refactor — migration report (2026-10-08)

> **STATUS: ARCHIVED (record of a one-time change).** Describes what was changed on branch
> `refactor/claude-context-architecture` (based on `origin/main` `02562b5`). Current documentation starts at
> [`docs/README.md`](../README.md).

## Why

A read-only audit the same day found that a new Claude Code session in this repository:

- had **no project `CLAUDE.md`**, but loaded the `CLAUDE.md` and `.claude/rules/` of a **different project** (a betting
  monorepo in the parent folder on Karol's machine);
- got its project knowledge mainly from Karol's local auto-memory (outside the repo, invisible to other developers);
  the most important product rule (the report never advises) was not in loaded context at all;
- met outdated entry points: `README.md` (broker/B2B model, subscriptions), `BLUEPRINT.md` ("governing document" with a
  Buy/Avoid decision engine), `frontend/README.md` (from the betting era), `docs/architecture.md` ("no implementation yet");
- had a ~136 KB, 1 690-line `PROJECT_STATE.md` session log and 55 unindexed documents in a flat `docs/`.

## What was analysed

All `CLAUDE.md`/rules/settings on the machine that load into this project; Claude memory; user-level skills, plugins and
hooks; every `.md` file in the repository; code and config references to documentation (`git grep`); Vercel, Railway,
Supabase and GitHub configuration in the repository; live GitHub deployments and branch rules (public API); the Supabase
migrations; the site copy for unverifiable claims.

## Canonical sources after the change

| Information | Canonical source |
|---|---|
| Instructions for every session | `CLAUDE.md` (new, 104 lines) |
| Folder-specific rules | `.claude/rules/frontend.md`, `report-objectivity.md`, `python-engine.md`, `supabase.md` (new, path-scoped) |
| Procedures | `.claude/skills/verify`, `deploy-check`, `prod-db-readonly` (new) |
| Current status | `PROJECT_STATE.md` (rewritten, 71 lines) |
| Architecture | `docs/architecture/overview.md` (new) |
| Product and product rules | `docs/product/overview.md` (new) |
| Environments, deploys, env var names | `docs/operations/environments.md` (new) + the two `.env.example` files |
| Database rules and production status | `docs/operations/database.md` (new) |
| Decisions | `docs/decisions/README.md` (new) |
| Map of all of the above | `docs/README.md` (new) |
| Workflow | `CONTRIBUTING.md` (unchanged) |

## Files

**Created:** `CLAUDE.md`; `.claude/rules/{frontend,report-objectivity,python-engine,supabase}.md`;
`.claude/skills/{verify,deploy-check,prod-db-readonly}/SKILL.md`; `docs/README.md`; `docs/architecture/overview.md`;
`docs/product/overview.md`; `docs/operations/environments.md`; `docs/operations/database.md`;
`docs/decisions/README.md`; `docs/archive/README.md`; this report.

**Rewritten:** `README.md` (Swedish, current), `frontend/README.md`, `PROJECT_STATE.md` (current state only).

**Moved with `git mv` (history kept)** — the full table is in [`docs/archive/README.md`](README.md):
- to `docs/archive/`: the old `PROJECT_STATE.md` (as `project-state-history-2026-10-08.md`), `BLUEPRINT.md`,
  `notion-project-plan-prompt.md`, docs `11`–`19`, `23`, `24`, `26`, `27`, `29`, `31`, `32`, `42`, `43`, `45`, `47`,
  `EXTRACTION_VALIDATION`, `MANUAL_INPUT_COVERAGE`, `analysis-engine-architecture`, `brf-knowledge-base`,
  `design-system`, `kopanalys-report-design`, `market_intelligence_audit_sprint5`, `reasoning-engine-knowledge-model`,
  `report-pdf-layout-blueprint` (32 files in all), and 3 into `docs/archive/brf-automation/`: `33`, `35`,
  `unified-brf-profile-design`;
- to `docs/research/`: `10`, `20`, `21`, `30`, `46`.

**Marked in place (STATUS banner, not moved because code comments link to them by path):** `docs/22`, `25`, `28`, `34`,
`36`–`40`, `44`, `48`, `architecture.md`, `data-sources.md`, `data-source-inventory.md`, `legal-data-migration-plan.md`.

**Every moved or archived file** got a two-line `STATUS` banner with the reason. Two relative links inside archived
documents were corrected (`./37_…` → `../37_…`). No other content of historical documents was changed.

**Deleted in the repository:** nothing.

**Not touched:** all application code, `supabase/` (migrations and config), `Dockerfile`, `.dockerignore`,
`railway.json`, `api/requirements.txt`, `api/server.py`, `.github/**`, `.gitignore`, `.env*`, `frontend/next.config.ts`,
`frontend/package*.json`, `.claude/launch.json`, `CONTRIBUTING.md`, `api/README.md`, `BRF-Scraper/README.md`.

## Context and memory changes (outside the repository, on Karol's machine)

- `.claude/settings.local.json` (gitignored, this project only): added `claudeMdExcludes` for the parent monorepo's
  `CLAUDE.md` and `.claude/rules/**`, and `skillOverrides` turning off the two SolidWorks support skills in this project.
  The global configuration and the other project were **not** changed. Permissions were left as they were.
- Claude memory for this project: backed up first, then reduced to what must not be in a public repository (team,
  budget, plans, personal working preferences, machine-specific facts) plus a pointer to the canonical documents.
  Five memories whose content is now canonical in the repository were removed; five were rewritten; two were added.

## Verification

| Check | Result |
|---|---|
| Only intended files changed (`git status`, `git diff --stat origin/main` for every production-critical path) | PASS — only `.md` files and new `.claude/rules`, `.claude/skills` |
| Markdown links in all 84 `.md` files resolve | PASS (after the two fixes above) |
| Paths named in the new documents exist | PASS (remaining hits were branch names, old paths in the move table, and partial paths) |
| No code reads a moved `.md` file (`git grep` for readers of `.md`; references are comments only) | PASS |
| YAML frontmatter of rules and skills parses (`paths`, `name`, `description`) | PASS |
| Secret-pattern scan of all new documents | PASS — nothing found |
| `pytest api/tests` (imports `server.py`, which loads the engine folders by path) | PASS — 51 passed, 1 skipped (translation model not present locally) |
| Frontend checks (`typecheck`, `i18n:check`, `verify`) | NOT RUN — no frontend file changed; local `node_modules` predates this branch's `package-lock.json` |
| A new session loads `CLAUDE.md` and no longer the parent project's files | **NOT VERIFIED** — the standalone `claude` CLI login had expired. Check with `/memory` in a new session |
| Build, deployment, environment and database configuration unchanged | PASS — no such file changed; nothing pushed |

## Could not be decided (UNKNOWN)

Which environment variables are actually set on Vercel and Railway; which engine URL Vercel Preview uses; whether the
GitHub secret `RAILWAY_TOKEN` exists; production Storage MIME settings; what the translation feature does in production
without its unapplied cache table; whether `docs/archive/42_platform_data_contracts.md` still matches any code; whether
`claudeMdExcludes` patterns match Windows paths in the form used (both a `C:/…` and a `**/…` form were added).

## REQUIRES REVIEW (nothing below was changed)

1. **The parent monorepo's `CLAUDE.md` and `.claude/rules/`** are global for that folder tree; excluded here only locally.
   Moving them into the betting project would fix it for every session — affects the other project, Karol's decision.
2. **The parent monorepo is its own git repository and tracks ~180 old copies of files under `projects/real-estate/`.**
   Git commands run in the wrong folder could commit or restore those copies.
3. **`.claude/settings.local.json` allows `Bash(git push *)` without asking** — recommended to remove (pushing to `main`
   is forbidden by `CONTRIBUTING.md` and branch protection is not active).
4. **GitHub branch protection is not active** — import `.github/rulesets/*.json` (repository admin).
5. **Production database:** migration history out of sync; `20261007000000` and `20261008120000` not applied.
6. **Site claims without a source:** "4.8/5 baserat på 256 omdömen", "Betrodd av fastighetsinvesterare över hela
   Sverige" (landing). **Privacy policy** says OpenAI interprets uploaded annual reports (it doesn't).
7. **Hemnet scraping** still reachable; legal plan is an open draft.
8. **Documents kept in place because code comments cite them** (list in `docs/README.md`): moving them needs comment
   updates in code, including `api/server.py` and `src/location_intelligence/` — a separate pull request.
9. **Vestigial code:** `src/real_estate/` (still in the root `pyproject.toml`), `scripts/setup-stripe-products.ts`,
   `start_frontend.bat`, untracked `Future_investment_engine/`, `ai-orchestrator/`, `deepseek-tasks/`; the root
   `pyproject.toml` depends on a folder outside this repository.
10. **`validation_reports/*.pdf`** — nine real BRF annual reports tracked in the public repository.
11. **`api/.env.example`** does not list `TRANSLATION_MODELS_DIR`/`TRANSLATION_THREADS` (documented in
    `docs/operations/environments.md` instead; the file is on the do-not-touch list for this refactor).
12. **Branches outside the naming rule** (`styleRedesign`, `mapDemoIntegration`, `backup/main-before-merge-2026-10-07`).
13. **Plugin skills** (Vercel, Stripe) still add many skill descriptions to every session; `skillOverrides` does not
    apply to plugin skills — disable a plugin per project only if it isn't needed.
14. After this branch is merged, the memory pointers that mention the branch can be shortened.
