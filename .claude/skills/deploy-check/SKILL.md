---
name: deploy-check
description: Check what a merge to main will put live, the preconditions before it, and verify afterwards which version runs on Vercel and Railway — read-only. Use before merging a pull request into main, after a deploy, or when Karol asks "är det live?", "vilken version körs?", "har det deployats?" or which branch a domain serves.
---

# Deploy check (read-only)

Nothing in this skill deploys, merges or changes settings. Merging is done by a person on GitHub; production settings
are changed by Karol. Background: `docs/operations/environments.md`.

## What a merge to `main` does

- **Vercel** builds `frontend/` and serves it on every production domain at once (`kopanalys.se`, `www`,
  `admin.kopanalys.se`, the `vercel.app` alias).
- **Railway** rebuilds the root `Dockerfile` and restarts `kopanalys-python-api` - only when the merge changes engine files
  (`watchPatterns` in `railway.json`). A frontend- or docs-only merge makes no Railway deployment; that is normal.
- **Supabase is not touched.** Migrations are applied by hand.

## Before the merge

1. `git fetch origin` and check the pull request is up to date with `origin/main`; CI shows **CI passed**.
2. **Migrations:** does the change add files in `supabase/migrations/`? Then they must be applied to production
   **before** the merge (Karol's OK, see `docs/operations/database.md`) — otherwise production pages that need them break.
3. **Environment variables:** does the change read a new variable (`git diff origin/main -- '*.ts' '*.py' | grep -E
   "process\.env|os\.environ"`)? It must exist in Vercel/Railway first; list the names for Karol (never values).
4. **Python engine:** changes to `Dockerfile`, `api/requirements.txt` or engine folders make the Railway build longer
   or the image heavier; mention it.
5. Say plainly what will change for visitors, and that it goes live on all domains at the same time.

## After the merge — verify from outside

- Which commit each platform deployed (public repository, no login needed):
  `curl -s "https://api.github.com/repos/karollek988/real-estate/deployments?per_page=6"` → `environment`, `sha`,
  `creator` (`vercel[bot]` = Vercel Production/Preview, `railway-app[bot]` = Railway).
  Status of one: `…/deployments/<id>/statuses` (`state: success`).
- Compare with `git rev-parse origin/main`. Railway's newest deployment may be an older commit: if the merge changed no engine
  file, none is made. A Railway `failure` is worth reading in the dashboard; one seen on 2026-10-09 was Docker Hub answering
  `429` for the base image (see `docs/operations/environments.md`).
- Railway, if the CLI is linked and logged in: `railway status` (read-only). Note: the CLI may be logged in with a
  different account than Karol's usual one — check the workspace it names.
- The site: load `https://kopanalys.se` and the changed page (built-in browser), check the console for errors. The
  admin portal and logged-in pages need Karol.
- Python engine health: `GET /` on the engine answers 200; protected routes answer 401 without the secret.

## If something is wrong

Don't push a fix to `main`. Report what you see; options for Karol: revert the pull request on GitHub (a new PR), or
promote the previous deployment in Vercel (Deployments → ⋯ → Promote). A Railway rollback is done in its dashboard.
