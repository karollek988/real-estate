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

## Migration status in production (as recorded 2026-10-07/08 — re-check before acting)

| Migration | In production? | Recorded in `schema_migrations`? |
|---|---|---|
| Everything up to `20260917010000` except `20260906000000` | yes | yes |
| `20260906000000_analyses_failure_reason` | yes (by hand) | **no** |
| `20261002000000`, `…000100`, `…000200` (credits, campaign removal, BRF reviews) | yes, 2026-10-02 (by hand) | **no** |
| `20261006000000_site_analytics` | yes, 2026-10-06 | **no** |
| `20261007000000_acquisition_analytics` | **no** — `record_acquisition` fails, the Markov tab falls back to example numbers | – |
| `20261007120000_content_items` (+ bucket `content-images`) | yes, 2026-10-07 | **no** |
| `20261007200000_remove_legacy_premium_campaign_broker_docs` | yes, 2026-10-07 | yes |
| `20261008000000_drop_subscription_columns` | yes, 2026-10-07 | yes |
| `20261008120000_text_translations` | **no** (not applied anywhere, per PROJECT_STATE 2026-10-08) | – |

Repairing the history (`supabase migration repair --status applied <version>`) and applying the two missing
migrations are **REQUIRES REVIEW**: they need Karol's OK and a read-only check of the current state first.

## Inventory of production, 2026-10-08 (read-only, the whole catalogue)

`supabase/diagnostics/inventory.sql` (SELECT only, no row data) was run in production's SQL Editor and compared line by
line with what the 29 migrations produce, step by step, on an empty database. Result:

- **History:** 21 rows, exactly the table above. Recorded but not in Git: none.
- **Structure equals the migrations up to `20261008000000`**, with three explained differences:
  1. `20261007000000_acquisition_analytics` and `20261008120000_text_translations` are absent (no table, no function).
  2. `properties.field_provenance` is `not null` but has **no default** (the migration says `default '{}'`). Harmless
     today - the app sends a value - and put right by step 3 below.
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

### The repair - prepared, NOT yet applied (`supabase/diagnostics/repair/`)

Every step needs Karol's explicit OK first (rule 2) and the backup of rule 4. Run them in this order, in the SQL Editor of
production; each is safe to repeat and runs as one transaction. After each, run `inventory.sql` again and compare.

| Step | File | What changes in production |
|---|---|---|
| 1 | `01-record-applied-migrations.sql` | **Only the history table:** 6 rows (`20260906000000`, `20261002000000/100/200`, `20261006000000`, `20261007120000`). No migration is run. |
| 2 | `02-apply-pending-migrations.sql` | **Adds** `analytics_arrivals_daily`, `analytics_consent_daily`, `record_acquisition()` and `text_translations`, then records both in the history. Changes nothing that exists. |
| 3 (optional) | `03-align-field-provenance-default.sql` | One column default on `properties.field_provenance`. No data. |

Step 2 goes before the code that needs it is relied on (rule 5): the arrival counting and the translation cache start
working the moment the tables exist. Only after step 1 and 2, merge the config change that switches off the send-email hook
(`fix/supabase-sync`): a valid config lets the GitHub integration run whatever is missing from the history.

## What lives where

- **Main tables:** `profiles`, `properties`, `analyses`, `analysis_requests`, `credit_purchases`, `saved_properties`,
  `brf_annual_reports` (+ `key_figures`), `brf_reviews`, `inspections`, `inspection_documents`, `inspection_photos`,
  `discount_codes`, `content_items`, `analytics_visitor_days`, `analytics_daily`; defined but not yet in production:
  `analytics_arrivals_daily`, `analytics_consent_daily`, `text_translations`. Read the migrations for the exact columns.
- **RPCs (service role only):** `consume_credit`, `refund_credit`, `grant_purchase_credits` (idempotent per Stripe
  session), `issue_discount_code`, `record_page_view`, (`record_acquisition` once applied).
- **Storage buckets:** `brf-annual-reports` (private), `inspection-files` (private), `content-images` (public, WebP).
  `broker-documents` was dropped on 2026-10-07. The local bucket config allows only PDF for annual reports although the
  app accepts Word and images — production's allowed types: UNKNOWN.
- **Auth:** Supabase Auth with a "Send Email" HTTP hook to the app (`/api/auth/send-email`, Resend).

## Known gotchas

- The repository's `supabase/config.toml` fails to load in the CLI because of the send-email hook secret format. The same
  error fails the GitHub check **"Supabase Preview"** (project `mifrdfjucyniddhlkudo`) on every push - it validates this file
  too, not only `supabase start` - and, while it fails, nothing is deployed to production. `fix/supabase-sync` switches the
  hook off in the file (the hook of the hosted project is set in the Dashboard and is not touched), after which the CLI loads
  the file as it is; until it is merged, to query the linked project run the CLI from a scratch folder that contains only a minimal `config.toml` and a copy of
  `supabase/.temp/` (details in the `prod-db-readonly` skill).
- Storage deletes go through `supabase storage rm … --linked --experimental`, with relative paths (a `C:` path is read as
  a URL scheme). Deletes need Karol's OK like any other production change.
- The last production cleanup (2026-10-07) has its backup in `real-estate-db-backups/2026-10-07-supabase-cleanup/`.
