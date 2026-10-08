# Köpanalys — frontend

The Next.js app behind kopanalys.se: the public site, the customer app and report, the API routes, the `/admin` console
and the `admin.kopanalys.se` portal. Deployed on Vercel from `main`. System overview:
[`docs/architecture/overview.md`](../docs/architecture/overview.md).

## Commands (run in `frontend/`)

| Command | What it does |
|---|---|
| `npm ci` | Install exactly what `package-lock.json` says |
| `npm run dev` | Development server on http://localhost:3001 (admin portal: http://admin.localhost:3001) |
| `npm run build` / `npm start` | Production build / serve it on port 3001 |
| `npm run typecheck` | TypeScript for the whole app (CI) |
| `npm run i18n:check` | Swedish and English texts have the same keys (CI) |
| `npm run verify` | Every `src/**/*.verify.mjs` — the project's tests (CI); `npm run verify -- <part of a path>` for some |
| `npm run colours` | Lists colours that don't come from `src/styles/_variables.scss` (not in CI yet) |
| `npm run lint` | ESLint (has old errors; not in CI yet) |
| `npm run admin:hash` | Hash a password for `ADMIN_PASSWORD_HASH` |

Environment: copy `.env.example` to `.env.local` (gitignored) — every variable is explained there. The repository root's
`start-local.ps1` starts a local Supabase stack and fills in its three Supabase variables for you.

## Where things are

| Path | What |
|---|---|
| `src/app/[locale]/` | Every page once; Swedish without prefix, English under `/en` |
| `src/app/api/` | API routes (analyses, Stripe, BRF upload, content, analytics, chat, translate, …) |
| `src/app/admin/` | BRF review console and content editor (Supabase login + `KOPANALYS_ADMIN_EMAILS`) |
| `src/pages/admin-portal/` | `admin.kopanalys.se`: statistics and Markov simulator (own password login) |
| `src/i18n/` | Languages and every visible text — read [`src/i18n/README.md`](src/i18n/README.md) |
| `src/lib/analysis/` | The analysis pipeline and data providers |
| `src/lib/report/`, `src/lib/brf/` | Report chapters and the BRF interpretation |
| `src/styles/_variables.scss` | The one source of colours, fonts and other design tokens |
| `src/proxy.ts` | Admin-host routing, Supabase session refresh, language routing |

Conventions (colours, texts, verify scripts, branches): [`CONTRIBUTING.md`](../CONTRIBUTING.md).
