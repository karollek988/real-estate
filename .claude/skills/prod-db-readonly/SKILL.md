---
name: prod-db-readonly
description: Inspect the production Supabase database without changing anything — migration history, whether a table/column/function/policy exists, row counts, bucket settings. Use when asked what is in production, whether a migration has been applied, or before proposing any database change. Never use it to write.
---

# Production database — read-only inspection

Production is Supabase project `mifrdfjucyniddhlkudo`; it is also what every Vercel Preview uses. Rules:
`docs/operations/database.md`.

## Allowed

- `supabase migration list --linked` — which migrations the remote history table knows about. (Several migrations ran
  by hand and are missing from that list on purpose — compare with the table in `docs/operations/database.md`.)
- `supabase db query --linked "<one SELECT statement>"` — catalog and data reads only, for example:
  - `select column_name, data_type from information_schema.columns where table_schema='public' and table_name='<t>'`
  - `select to_regclass('public.<table>')`, `select proname from pg_proc where proname='<fn>'`
  - `select policyname, cmd, roles from pg_policies where tablename='<t>'`
  - `select count(*) from public.<t>`
  - `select id, public, file_size_limit, allowed_mime_types from storage.buckets`
- From outside, with the site's public (anon) key: PostgREST requests that must be **refused** (to check RLS).

## Never

`insert`, `update`, `delete`, `alter`, `create`, `drop`, `grant`, `revoke`, `truncate`, calling functions that write,
`supabase db push`, `supabase migration up --linked`, `supabase migration repair`, `supabase storage rm/mv/cp`
against the linked project — and never printing keys, tokens or connection strings. `supabase db query` executes
whatever it is given, so check every statement before running it. Don't select personal data (e-mails, names) unless
the task needs it; prefer counts.

## How to run it on this machine

The CLI must be logged in and linked (`supabase/.temp/project-ref` exists). Since 2026-10-09 the repository's
`supabase/config.toml` loads in the CLI (the send-email hook is switched off in it), so the commands can run from the
repository. If the file ever fails to load again, run from a scratch folder **outside the repository**:

1. Create a scratch folder with a `supabase/` folder inside it, holding a minimal `config.toml` and a copy of the
   repository's `supabase/.temp/` (`project-ref`, `pooler-url`, `linked-project.json`). This worked on 2026-10-07; the
   exact minimal `config.toml` was not recorded — start from `project_id = "real-estate"`, and if the CLI still fails,
   copy the repository's `config.toml` there and remove its `[auth.hook.send_email]` block.
2. Run the command from that scratch folder (or with `--workdir <scratch folder>`).
3. Delete nothing in the repository; the scratch folder can be removed afterwards.

If the CLI is not logged in or not linked, stop and tell Karol; don't log in for him.

## Before any change you want to propose

1. Read the current state with the queries above and write down what you found (with the date).
2. Write the change as a new migration file (see `.claude/rules/supabase.md`), show it to Karol, and state what it
   needs first: a backup of the affected data to `real-estate-db-backups/` next to the repository.
3. Apply nothing until Karol says yes to that exact change. Afterwards, re-read and update the status table in
   `docs/operations/database.md`.
