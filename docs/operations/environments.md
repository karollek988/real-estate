# Environments, deployment and configuration

> **STATUS: CURRENT.** Canonical map of the environments, the services in each, how a change reaches production and
> which environment variables exist. **No values here, ever** — only names. What each variable does is documented next to
> it in [`frontend/.env.example`](../../frontend/.env.example) and [`api/.env.example`](../../api/.env.example); those two
> files are the canonical list of names. Verified against the code on 2026-10-08; facts that come from records rather
> than a check today are marked with their source.

## The three environments

| | Local | Preview | Production |
|---|---|---|---|
| Frontend | `next dev` on `http://localhost:3001` (`npm run dev` in `frontend/`, or `start-local.ps1`) | Vercel Preview deployment of any branch other than `main` (behind Vercel login) | Vercel Production deployment of `main` |
| Domains | `localhost:3001`, `admin.localhost:3001` | `*.vercel.app` preview URLs only | `kopanalys.se`, `www.kopanalys.se`, `admin.kopanalys.se`, `real-estate-brown-chi.vercel.app` (all the same build; recorded 2026-10-07) |
| Python engine | `uvicorn` on `127.0.0.1:8000` ([`api/README.md`](../../api/README.md)) | **UNKNOWN** which engine URL Preview uses | Railway service `kopanalys-python-api` (environment `production`) |
| Database | Local Supabase stack via Docker (`supabase start`; API 54331, DB 54332, Studio 54333, mail 54334) | **The production Supabase project** — rows created on Preview are real | Supabase project `mifrdfjucyniddhlkudo` |
| Config lives in | `frontend/.env.local`, shell env for the engine (both gitignored, never committed) | Vercel → Settings → Environment Variables (Preview) | Vercel (Production), Railway service variables, Supabase/Stripe dashboards |

DNS for `kopanalys.se` is at Simply.com, not at Vercel. A new subdomain needs a DNS record there.

## How a change reaches production

```text
feature/… | fix/… | refactor/… branch ── pull request (CI "CI passed", squash) ──► main
                                                                                              │
                                     ┌────────────────────────────────────────────────────────┤
                                     ▼                                                        ▼
                         Vercel builds frontend/ → every domain               Railway builds the root Dockerfile
```

- **Every push to `main` goes live on every domain and on Railway at once.** There is no staging step.
- **The database is never changed by a deploy.** Migrations are applied by hand, with Karol's approval, before the
  code that needs them is merged (see [`database.md`](database.md)).
- **An environment variable change only reaches deployments built after it**: redeploy afterwards
  (Vercel → Deployments → ⋯ → Redeploy).
- **`main` is protected by a GitHub ruleset** (checked 2026-10-09 with the rules API: no deletion, no force-push, a
  pull request, the check "CI passed", squash only, **0 approvals** so the author can merge their own). The rules are
  kept as importable files in `.github/rulesets/`; the live settings are in GitHub (Settings → Rules).
- How to check what is live: the `deploy-check` skill (`.claude/skills/deploy-check/SKILL.md`).

## Environment variables

Legend: **Secret** = must never be shown, logged or committed. **Public** = ends up in the browser by design.
"Recorded set" = a record says it was set in Production; nobody has listed Vercel's variables since (UNKNOWN otherwise).

### Next.js app (Vercel; locally `frontend/.env.local`)

| Name | Kind | Needed for | Recorded set in Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Everything | yes (read from the live site's bundle, docs/48) |
| `NEXT_PUBLIC_SITE_URL` | Public | Links/logo in e-mails | UNKNOWN |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Pipeline, admin, webhooks | UNKNOWN |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **Secret** | Checkout, webhook | UNKNOWN |
| `STRIPE_PRICE_OMRADESANALYS`, `STRIPE_PRICE_TRYGGHETSPAKET`, `STRIPE_PRICE_TRE_BOSTADER` | Config | Checkout per package | yes, 2026-10-02 (docs/48) |
| `STRIPE_COUPON_ANALYSIS_50OFF` | Config | Discount codes | UNKNOWN |
| `RESEND_API_KEY` | **Secret** | Contact form, auth e-mails, BRF e-mails | UNKNOWN |
| `RESEND_FROM_EMAIL` | Config | Sender address | UNKNOWN |
| `SEND_EMAIL_HOOK_SECRET` | **Secret** | Supabase "Send Email" hook → `/api/auth/send-email` | UNKNOWN |
| `PYTHON_ENGINE_API_URL` | Config | Calls to the engine | UNKNOWN |
| `PYTHON_ENGINE_API_SECRET` | **Secret** | Must equal Railway's value exactly | yes (2026-09, PROJECT_STATE history) |
| `OPENAI_API_KEY` | **Secret** | FAQ chat (`/api/chat`) only | UNKNOWN |
| `ADMIN_PASSWORD_HASH` | **Secret** | `admin.kopanalys.se` login (no built-in fallback) | yes, 2026-10-07 |
| `ADMIN_SESSION_SECRET`, `ANALYTICS_HASH_SECRET` | **Secret** | Optional; derived from the service role key if unset | UNKNOWN |
| `KOPANALYS_ADMIN_EMAILS`, `KOPANALYS_TEAM_EMAILS` | Config | Who may use `/admin`; where BRF review e-mails go | yes, 2026-10-02 (docs/48) |
| `TRAFIKLAB_RESROBOT_API_KEY`, `TRAFIKVERKET_API_KEY` | **Secret** | Commute and infrastructure providers | UNKNOWN |
| `BOOLI_CALLER_ID`, `BOOLI_API_KEY` | **Secret** | Booli provider — **not configured anywhere known** | no |
| `PARSE_API_KEY`, `PARSE_BOOLI_BASE_URL` | **Secret** | Parse.bot provider — disabled in code | – |
| `DISABLED_PROVIDERS` | Config | Turn providers off | UNKNOWN |
| `CONTENT_DEMO`, `BRF_REVIEW_EMAILS`, `ADMIN_STATS_DEMO`, `NEXT_PUBLIC_DEV_ADMIN_EMAIL` | Dev only | Demo content/data, dev e-mails, dev admin | – |
| `VERCEL_ENV`, `NODE_ENV` | Set by the platform | – | – |

Locally, `frontend/.env.local` also still holds some names from the removed Premium/subscription model
(e.g. `STRIPE_PRICE_PREMIUM_*`); the code no longer reads them.

### Python engine (Railway service variables; locally the shell or `api/.env`)

| Name | Kind | Note |
|---|---|---|
| `PYTHON_ENGINE_API_SECRET` | **Secret** | Required; unset = every request 500, mismatch = 401 |
| `PORT` | Platform | Set by Railway |
| `TRAFIKVERKET_API_KEY`, `LANTMATERIET_CLIENT_ID`, `LANTMATERIET_CLIENT_SECRET` | **Secret** | Optional providers |
| `DISABLED_PROVIDERS`, `LI_*`, `MI_*`, `MAX_CONCURRENT_BROWSER_FETCHES` | Config | Optional tuning (see `api/.env.example`) |
| `TRANSLATION_MODELS_DIR` | Config | Set to `/models` by the `Dockerfile` |
| `TRANSLATION_THREADS` | Config | Optional, read by `api/translation.py`; not in `api/.env.example` |
| `OPENAI_API_KEY` | **Secret** | Only for the command-line tool `analysis_engine/run.py --ai`, not the service |

Which of these are set on Railway today: **UNKNOWN** (only `PYTHON_ENGINE_API_SECRET` is recorded as checked).

### Elsewhere

- **GitHub Actions secret** `RAILWAY_TOKEN` — needed by `restart-python-engine.yml`; whether it is set: UNKNOWN.
- **Supabase dashboard** — Auth → Hooks → "Send Email" HTTP hook pointing at the site's `/api/auth/send-email`, with
  the secret that equals `SEND_EMAIL_HOOK_SECRET`. Locally the same hook is configured in `supabase/config.toml`.
- **Stripe dashboard** — the three Prices, the 50 % coupon, and the webhook endpoint `/api/stripe/webhook`.

## Who may change what

- Production variables, domains, Stripe objects and Supabase settings are changed by **Karol** (or the team member who
  owns the area). Claude may prepare the change and verify it afterwards, but does not open Vercel's environment
  variable pages and never handles secret values.
- The repository is **public**. Never commit `.env*` files (only `.env.example`), keys, receipts or personal data.
  The git history was cleaned on 2026-10-08; anyone with an older clone must re-clone and never push old branches.
- Docker on this machine: publish ports on `127.0.0.1` only (the Wi-Fi network can otherwise reach them).
