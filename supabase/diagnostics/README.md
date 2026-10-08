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

## The repair of the migration history (done 2026-10-08/09)

After the first inventory of production, three one-time SQL steps brought the history back in line with the database: six
history rows for migrations that had been applied by hand, the two migrations production lacked, and the missing default of
`properties.field_provenance`. They were run by Karol (with a backup first) and checked afterwards (an inventory: 29 history rows, no migration
missing; a query: the default is in place), and then deleted from the repository. What each step changed is in
`docs/operations/database.md`. A repair is not a routine: run `inventory.sql`, compare, and write the steps for what it shows.

## Why it matters

If the GitHub integration applies migrations on merge (its "Deploy to production" option - Karol found no such option in
the project's settings on 2026-10-09, so this is unconfirmed), it applies every migration in Git that is missing from
`supabase_migrations.schema_migrations`. Run against a database that already has the objects, many of the migrations fail
(`policy ... already exists`), and some would run and bring back things that were removed on purpose (dropped columns, the
`broker_documents` table and its bucket, old functions). The history table therefore has to match reality before that
can happen.
