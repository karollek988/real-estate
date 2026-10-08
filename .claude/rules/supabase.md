---
paths:
  - "supabase/**"
---

# Supabase migrations and configuration

Production uses one Supabase project for Preview **and** Production. Full rules and the production migration status:
`docs/operations/database.md` — read it before proposing any database change.

- **Existing migrations are frozen.** Never edit, rename, reorder or delete a file in `supabase/migrations/`, not even to
  "clean up". A change is a new file `supabase/migrations/<yyyymmddhhmmss>_<what>.sql` with the current timestamp.
- Write migrations to be safe to re-run (`if not exists`, `create or replace`, `on conflict do nothing`) — several
  were applied by hand in the SQL editor.
- New tables: enable RLS; public reads only the columns the site shows; writes through the service role or a
  `security definer` RPC with `execute` revoked from `anon` and `authenticated`.
- Test against the **local** stack only: `supabase start`, then `supabase migration up --local`.
- **Never** use `--linked` for anything that writes (`db push`, `migration up --linked`, `migration repair`,
  `storage rm`), and never run SQL against production, without Karol's explicit OK for that exact change. Reading
  production: the `prod-db-readonly` skill.
- In the pull request, say which migrations must be applied to production **before** the code is merged, and add them
  to the status table in `docs/operations/database.md`.
- `supabase/config.toml` drives the local stack (ports, buckets, the send-email hook) **and is validated by the GitHub check
  "Supabase Preview"** on every push: an invalid value (such as an enabled hook without its secret) fails that check. If the
  integration applies migrations on merge (unconfirmed: the project's settings show no "Deploy to production" option), a
  valid file lets it deploy migrations that are missing from the history. Change it only when the task is about
  it (the migration history matches production since 2026-10-09: `docs/operations/database.md`).
