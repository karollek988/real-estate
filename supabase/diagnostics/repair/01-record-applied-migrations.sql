-- STEP 1 of 3 - the migration HISTORY only. Nothing but supabase_migrations.schema_migrations is touched.
--
-- Production already contains what these 6 migrations create (checked with supabase/diagnostics/inventory.sql on 2026-10-08: the
-- tables, columns, constraints, functions, policies and buckets are all there). They were applied by hand in the SQL
-- Editor, and the SQL Editor does not write to the history table, so it has no row for them. Without a row, the
-- GitHub integration ("Deploy to production") would try to run them again; several of them fail when run twice.
--
-- The migration files themselves are NOT run here. Safe to run more than once: a row that exists is left alone.

insert into supabase_migrations.schema_migrations (version, name)
values
  ('20260906000000', 'analyses_failure_reason'),
  ('20261002000000', 'credits_and_analysis_scopes'),
  ('20261002000100', 'remove_first100_campaign'),
  ('20261002000200', 'brf_reviews'),
  ('20261006000000', 'site_analytics'),
  ('20261007120000', 'content_items')
on conflict (version) do nothing;

-- Check: 27 rows after this step (21 were there already).
select count(*) as recorded_migrations from supabase_migrations.schema_migrations;
