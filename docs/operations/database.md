# Database (Supabase) — rules, status and how to inspect it

> **STATUS: CURRENT.** Canonical source for the database rules and the known state of production. The schema itself
> is defined only by `supabase/migrations/*`. Status of production comes from records dated below — **check before
> relying on it** (read-only, see the `prod-db-readonly` skill).

## The projects

| | Where | Notes |
|---|---|---|
| Production | Supabase project `mifrdfjucyniddhlkudo` (the project the live site's bundle points at; `supabase/.temp/project-ref` when the CLI is linked) | **Also used by every Vercel Preview deployment** — test data created on a preview is real data |
| Local | `supabase start` from the repo root (Docker), configured by `supabase/config.toml` | API `127.0.0.1:54331`, DB 54332, Studio 54333, mail 54334. `start-local.ps1` starts it and the app |

There is no staging database.

## Rules (non-negotiable)

1. **Never edit, rename, reorder or delete an existing migration file.** Some have run in production by hand; their
   names and contents are the record. A change to the schema is always a **new** file
   `supabase/migrations/<yyyymmddhhmmss>_<what>.sql`, named after the current time.
2. **Nothing touches production without Karol's explicit OK for that specific change** — no `supabase db push`, no
   SQL editor statements, no Storage deletes, no data fixes. Prepare the SQL, show it, wait.
3. **Never run `supabase db push` against production** while the migration history is out of sync (see below): it
   would try to re-apply migrations that already ran by hand.
4. **Back up before any approved change** — the affected tables/columns/objects — to a dated folder in
   `real-estate-db-backups/`, the folder next to this repository (never inside the public repository).
5. **Apply the migration before merging code that needs it.** A deploy never runs migrations; code that expects a
   missing table breaks production pages.
6. **New tables get RLS.** Follow the existing pattern: public reads only what the site shows, writes through the
   service role or `security definer` RPCs with `execute` revoked from `anon`/`authenticated`.
7. **Reading production is allowed** (schema, counts, migration list) through the `prod-db-readonly` skill — `SELECT`
   only, no secrets printed.

## Migration status in production (repaired and verified 2026-10-08 — re-check before acting)

| Migration | In production? | Recorded in `schema_migrations`? |
|---|---|---|
| The 29 files up to `20261008120000_text_translations` | yes | **yes - 29 of 29** |
| `20261009182000_analysis_release` (adds `analyses.released_at` / `released_by`) | **not yet - apply by hand BEFORE the code that reads it is merged** | no |

`20261009182000_analysis_release`: existing analyses count as released (so every report customers can see today stays
visible); new full analyses start unreleased. It is safe to run twice - only the run that adds the columns releases the
existing rows. The code fails closed: with the column missing every full report would be held back and a new area
analysis could not be created, so the order is: backup of `analyses` (rule 4) → run the file in the SQL Editor → add
its row to `supabase_migrations.schema_migrations` → merge.

How it got there: before 2026-10-08 six migrations had been applied by hand (`20260906000000`, `20261002000000/100/200`,
`20261006000000`, `20261007120000`) and were missing from the history, and two had never been run
(`20261007000000_acquisition_analytics`, `20261008120000_text_translations`). On 2026-10-08 the six were recorded and the
two were applied and recorded (steps 1 and 2 below), and a second inventory confirmed it: 29 history rows, no migration
missing, and the only differences from Git are the ones explained below. The one remaining difference,
`properties.field_provenance` having no default, was put right by step 3 on 2026-10-09 (checked afterwards: the column
default is `'{}'::jsonb`).

A new migration is applied to production **by hand first** (rule 5) and then recorded in the history - or run through the
GitHub integration once that has been checked; either way, the history table must list it, or the next deploy tries it again.

## Inventory of production, 2026-10-08 (read-only, the whole catalogue)

`supabase/diagnostics/inventory.sql` (SELECT only, no row data) was run in production's SQL Editor and compared line by
line with what the 29 migrations produce, step by step, on an empty database. Result:

- **History:** 21 rows. Recorded but not in Git: none. (Now 29, see above.)
- **Structure equals the migrations up to `20261008000000`**, with three explained differences:
  1. `20261007000000_acquisition_analytics` and `20261008120000_text_translations` are absent (no table, no function).
  2. `properties.field_provenance` is `not null` but had **no default** (the migration says `default '{}'`). Not
     harmless: `insertProperty` creates a property without that column (only `updateProperty` sets it later), so a new
     property would have been refused by the not-null check. Whether an insert ever failed is not known. Put right by
     step 3 below (run 2026-10-09).
  3. The bucket `brf-annual-reports` exists although no migration creates it: `supabase/config.toml`
     (`[storage.buckets.brf-annual-reports]`) declares it, so Git does explain it.
- **Functions:** all 13 that exist equal the Git versions. Production's bodies carry Windows line endings (pasted from
  Windows into the SQL Editor) - the only difference.
- Nothing in production that Git does not explain; no migration is half applied.

**Why the history must be repaired before anything deploys.** Replayed against a database that already has them, 8 of the
29 migrations fail ("policy already exists", "constraint already exists") and 7 bring back things that were removed on
purpose (dropped columns, `broker_documents` and its bucket, old functions). Tested on a throwaway database made to look
like production: with the history as it is, the CLI reports 21 migrations in both places, 8 only in Git, and
`supabase db push` refuses ("Found local migration files to be inserted before the last migration on remote
database"); after the three steps below it reports 29 of 29 and "Remote database is up to date".

### The repair - done in three steps, 2026-10-08 and 2026-10-09

Each step had Karol's explicit OK first (rule 2) and the backup of rule 4, and was run by Karol in the SQL Editor of
production as one transaction. The one-time SQL files were deleted afterwards (2026-10-09): they are finished, and
running them again would do nothing. The state before is kept in `real-estate-db-backups/2026-10-08-migration-history/`;
the state after steps 1 and 2 is the second inventory there.

| Step | What it changed in production |
|---|---|
| 1 (2026-10-08) | **Only the history table:** 6 rows (`20260906000000`, `20261002000000/100/200`, `20261006000000`, `20261007120000`). No migration was run. |
| 2 (2026-10-08) | **Added** `analytics_arrivals_daily`, `analytics_consent_daily`, `record_acquisition()` and `text_translations`, then recorded both migrations in the history. Changed nothing that existed. |
| 3 (2026-10-09) | One column default: `properties.field_provenance` default `'{}'::jsonb`, as its migration says. No data. |

The next time the history and the database might disagree, run `supabase/diagnostics/inventory.sql` first (read-only) and
repair from what it shows, not from this table.

Production's `record_acquisition()` is the file's text with Windows line endings, like the older functions (pasted from
Windows into the SQL Editor): the same function. The arrival counting (`/api/analytics/arrival`) and the translation cache
start working now that the tables exist.

The config change that switches off the send-email hook (`fix/supabase-sync`) goes in **after** steps 1 and 2 - and it did,
as a precaution: if the GitHub integration applies migrations on merge, a valid config lets it run whatever is missing
from the history, and nothing is missing any more. Whether it does is **not confirmed** - Project Settings -> Integrations
-> GitHub has no "Deploy to production" option (Karol, 2026-10-09) - so treat the risk as real until it is.

## What lives where

- **Main tables:** `profiles`, `properties`, `analyses`, `analysis_requests`, `credit_purchases`, `saved_properties`,
  `brf_annual_reports` (+ `key_figures`), `brf_reviews`, `inspections`, `inspection_documents`, `inspection_photos`,
  `discount_codes`, `content_items`, `analytics_visitor_days`, `analytics_daily`, `analytics_arrivals_daily`,
  `analytics_consent_daily`, `text_translations`. Read the migrations for the exact columns.
- **RPCs (service role only):** `consume_credit`, `refund_credit`, `grant_purchase_credits` (idempotent per Stripe
  session), `issue_discount_code`, `record_page_view`, `record_acquisition`.
- **Storage buckets:** `brf-annual-reports` (private), `inspection-files` (private), `content-images` (public, WebP).
  `broker-documents` was dropped on 2026-10-07. The local bucket config allows only PDF for annual reports although the
  app accepts Word and images — production's allowed types: UNKNOWN.
- **Auth:** Supabase Auth with a "Send Email" HTTP hook to the app (`/api/auth/send-email`, Resend).

## Known gotchas

- **Fixed 2026-10-09 (PR #8):** `supabase/config.toml` used to fail to load in the CLI because of the send-email hook
  secret format. The same error failed the GitHub check **"Supabase Preview"** (project `mifrdfjucyniddhlkudo`) on every
  push - it validates this file too, not only `supabase start`. The hook is now switched off in the file (the hook of the
  hosted project is set in the Dashboard and was not touched), the CLI loads the file as it is, and the check passed on
  `main` after #8 and #9. If it ever fails to load again, the scratch-folder route in the `prod-db-readonly` skill still works.
- The failure was `auth.hook.send_email.secrets must be formatted as "v1,whsec_<base64_encoded_secret>"` (first seen
  2026-10-07 on `bf0562e`; the check is skipped on pull requests and runs on `main`): `config.toml` reads the secret from
  `env(SEND_EMAIL_HOOK_SECRET)`, which the integration does not have. Whether the integration applies migrations to
  production when one is merged: UNKNOWN - the project's settings show no "Deploy to production" option. The migration
  history matches production now (29 of 29), so a merge changes nothing today; apply any new migration by hand first (rule 5).
  **REQUIRES REVIEW** before anyone "fixes" the check.
- Storage deletes go through `supabase storage rm … --linked --experimental`, with relative paths (a `C:` path is read as
  a URL scheme). Deletes need Karol's OK like any other production change.
- The last production cleanup (2026-10-07) has its backup in `real-estate-db-backups/2026-10-07-supabase-cleanup/`.
