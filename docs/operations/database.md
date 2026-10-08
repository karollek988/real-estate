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

- The repository's `supabase/config.toml` fails to load in the CLI because of the send-email hook secret format. To
  query the linked project, run the CLI from a scratch folder that contains only a minimal `config.toml` and a copy of
  `supabase/.temp/` (details in the `prod-db-readonly` skill).
- The same config error makes the **Supabase GitHub integration** fail on every push to `main` (check "Supabase Preview",
  first failure 2026-10-07 on `bf0562e`; skipped on pull requests). Its message: `auth.hook.send_email.secrets must be
  formatted as "v1,whsec_<base64_encoded_secret>"` — `config.toml` reads it from `env(SEND_EMAIL_HOOK_SECRET)`, which the
  integration does not have. Whether the integration would apply migrations to production once the config loads:
  UNKNOWN — check its settings in the Supabase dashboard first, because the migration history is out of sync (rule 3).
  **REQUIRES REVIEW** before anyone "fixes" the check.
- Storage deletes go through `supabase storage rm … --linked --experimental`, with relative paths (a `C:` path is read as
  a URL scheme). Deletes need Karol's OK like any other production change.
- The last production cleanup (2026-10-07) has its backup in `real-estate-db-backups/2026-10-07-supabase-cleanup/`.
