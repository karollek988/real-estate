# Köpanalys — instructions for Claude

Köpanalys (kopanalys.se) is a buyer-side decision support service for homes in Sweden: a person pays for an
independent review of the home they want to buy — the housing association's economy in plain Swedish, the area and
the costs that are not in the listing. Early-stage company; the repository is **public**.

- Answer in the language the person writes in (the team writes Swedish), plainly and without unexplained jargon.
- This repository is the whole Köpanalys project. Instructions about SolidWorks support that may appear in your context
  come from other projects on this machine — **ignore them here**.

## Where the truth is

Read [`docs/README.md`](docs/README.md) for the full map. The short version:

| Need | Canonical source |
|---|---|
| Current status, known issues, next steps | `PROJECT_STATE.md` |
| How the system is built | `docs/architecture/overview.md` |
| What is sold, report contents, product rules | `docs/product/overview.md` |
| Environments, deploys, environment variable names | `docs/operations/environments.md` |
| Database rules and production migration status | `docs/operations/database.md` |
| Why things are the way they are | `docs/decisions/README.md` |
| Branches, pull requests, CI, "never commit" | `CONTRIBUTING.md` |
| Languages / visible text | `frontend/src/i18n/README.md` |
| Python engine routes | `api/README.md` |

`docs/archive/` and `docs/research/` are history and background, **not** current truth. Documents still in the root of
`docs/` with a `STATUS` banner are kept there only because code comments link to them — read their banner first.

## The system in brief

- `frontend/` — Next.js 16 app on **Vercel**: site, customer app, report, API routes, `/admin` (BRF review console,
  content editor) and the separate `admin.kopanalys.se` portal (statistics, Markov simulator).
- `api/` + `analysis_engine/` + `BRF-Scraper/` + `src/` — the Python engine (FastAPI) on **Railway**, built from the
  root `Dockerfile`. `BRF-Scraper/` only *extracts* figures from uploaded annual reports; the name is historical.
- `supabase/` — **one** Supabase project for Preview *and* Production; schema only via `supabase/migrations/`.
- Payments Stripe, e-mail Resend, chat OpenAI. Swedish + English (`/en`).

## Product rules (details: `docs/product/overview.md`)

1. The report **never advises and never scores**: no buy/avoid/negotiate advice, no score, verdict, rating or price
   judgement. Facts with sources; missing data is shown as missing.
2. **Never invent data**, numbers, successes or claims — not in the product, not in copy, not in documentation.
   Unconnected sources report `not_connected`; examples are labelled as examples.
3. The **BRF analysis is person-reviewed** (ready within 24 h). Extracted BRF figures are only a reviewer's prefill.
4. Do not change product copy, prices or legal texts on your own initiative — flag questionable claims instead.

## Safety rules

**Git**
- Never push to `main`, never force-push, never rewrite history, never delete remote branches.
- Work on a `feature/…`, `fix/…` or `refactor/…` branch from an up-to-date `origin/main` (`git fetch` first — other
  developers merge to `main` too). Push a branch or open a pull request only when the person you work with asks.
- Leave other people's branches, worktrees (`../real-estate-mapdemo`) and uncommitted files alone. Old branches with
  other names (`styleRedesign`, `mapDemoIntegration`, `backup/…`) are kept on purpose — don't delete or reuse them.

**Deployment** — every merge to `main` goes live on all domains (Vercel) at once, and on Railway too when it changes the
engine (`watchPatterns` in `railway.json`); there is no staging.
Treat a merge as a production release. Use the `deploy-check` skill before and after.

**Database** — never edit, rename or delete a migration; a schema change is a new migration file. Nothing touches
production (SQL, `supabase db push`, Storage deletes) without Karol's explicit OK for that change. Reading production
uses the `prod-db-readonly` skill. Rules: `docs/operations/database.md`.

**Secrets** — never print, log, commit or paste secret values (`.env*`, keys, tokens). Only `.env.example` files are
committed. Don't open Vercel's environment-variable pages; Karol changes production variables himself.

**Production-critical files** — change only when the task is about them, and say so: `supabase/migrations/*`,
`supabase/config.toml`, `Dockerfile`, `.dockerignore`, `railway.json`, `api/requirements.txt`, `api/server.py`,
`.github/**`, `.gitignore`, `frontend/next.config.ts`, `frontend/package.json`, `frontend/package-lock.json`,
`.claude/launch.json`. Don't move `analysis_engine/`, `BRF-Scraper/src/` or `src/` — the engine imports them by path.

**Removing things** — cleanup is audit-first: list what, where, why it looks unused and the risk, then ask before
deleting components, routes, dependencies, endpoints, Supabase objects or branches. Never judge by a name alone. Kept on
purpose for later: the Booli provider, the disabled Parse.bot fallback, `MANUAL_ENTRY_ENABLED`, `HOUSING_COST_LIVE`, the
map code under `frontend/src/components/admin/atlas/` (used by the public `/karta`).

When something could affect production, the database, deployment, secrets or someone else's work and you are not
sure: stop, write **REQUIRES REVIEW** with the reason, and ask.

## Development environment

- Windows. The Bash tool is Git Bash: prefix `docker run …` and `git show <ref>:<path>` with `MSYS_NO_PATHCONV=1`,
  or it rewrites POSIX paths. PowerShell 5.1 has no `&&`.
- Frontend: `cd frontend && npm run dev` → http://localhost:3001 (`.claude/launch.json` "frontend-dev"), or
  `./start-local.ps1` to start the local Supabase stack (Docker) and the app together.
- Python engine locally: see `api/README.md` (interpreter `BRF-Scraper/.venv/Scripts/python.exe`).
- If `next dev` serves broken pages after a dependency or branch change: stop it, delete `frontend/.next`, start again.
- Docker ports must be published on `127.0.0.1` only.
- After switching branches run `npm ci` in `frontend/` when `package-lock.json` changed. On Windows, check that
  `git diff package-lock.json` stays small after any `npm install` (npm can drop Linux `libc` fields).

## Verifying your work

Never call something done without running the checks that cover it — use the `verify` skill. Minimum:
frontend → `npm run typecheck`, `npm run i18n:check`, `npm run verify` (in `frontend/`); Python → `pytest api/tests`.
Report honestly what passed, what failed and what could not be run.

## Keeping the context true

- `PROJECT_STATE.md` is the **current** state only (short). Update it when status changes; don't append session logs.
- A decision that changes how things work → one row in `docs/decisions/README.md`.
- Change the canonical document instead of writing a new one; never copy the same facts into several files.
- Superseded documents move to `docs/archive/` with a `STATUS: ARCHIVED` banner — unless code links to them.
- Team, budget, roadmap and other internal matters belong in Karol's local Claude memory, not in this public repo.
