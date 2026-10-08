# Supabase diagnostics

Scripts for looking at a database. They are **not** migrations: they live outside `supabase/migrations`, so the Supabase
CLI and the GitHub integration never run them.

## `inventory.sql` - what is really in the database

Read-only (SELECT only). Safe to run on production. It reads **no row data** - no e-mail addresses, addresses or codes -
only the migration history, the names and shapes of tables, functions, policies, triggers, constraints, indexes, storage
bucket settings, the privileges of `anon`/`authenticated`/`service_role`, and approximate row counts.

1. Supabase dashboard -> the project -> **SQL Editor** -> New query.
2. Paste the whole file and press **Run**. The result is one column of text lines (about 250).
3. Copy all of them (the result grid's *Copy* / *Export CSV*) and hand them over.

The lines are compared with what the migrations in `supabase/migrations` should produce, step by step, to find out which
migrations the database really has - which is not always what `supabase_migrations.schema_migrations` says: several
migrations were applied by hand in the SQL Editor, and a migration applied that way is not recorded in that table.

## Why it matters

The GitHub integration with "Deploy to production" switched on applies every migration in Git that is missing from
`supabase_migrations.schema_migrations`. Run against a database that already has the objects, many of the migrations fail
(`policy ... already exists`), and some would run and bring back things that were removed on purpose (dropped columns, the
`broker_documents` table and its bucket, old functions). The history table therefore has to match reality before that
switch is on.
