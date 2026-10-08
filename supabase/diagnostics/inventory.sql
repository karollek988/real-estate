-- READ-ONLY inventory of a Köpanalys database: what the migration history says, and what is really in it.
--
-- Only SELECT statements. Nothing here creates, changes or deletes anything; it is safe to run on production.
-- It lives outside supabase/migrations on purpose, so the Supabase CLI and the GitHub integration never run it.
--
-- How to use: open the project in the Supabase dashboard -> SQL Editor -> paste the whole file -> Run.
-- The result is one column of text lines. Copy them all (or use "Copy" / "Export CSV") and hand them over; they are
-- compared with what the 29 migrations in Git should have produced (supabase/diagnostics/README.md).
--
-- No row data is read (no emails, no addresses, no codes): only names, shapes and counts of rows.
-- Only the schemas public and storage (bucket settings), and the triggers on auth.users, are looked at.

select line
from (
  -- 1. What the migration history table says has been applied
  -- (read through query_to_xml so that a missing history table gives one line instead of an error)
  select 10 as section,
         'HISTORY|' || coalesce((xpath('/row/version/text()', r))[1]::text, '?') || '|' || coalesce((xpath('/row/name/text()', r))[1]::text, '') as line
  from unnest(xpath('/table/row', query_to_xml(
         case when to_regclass('supabase_migrations.schema_migrations') is not null
              then 'select version, to_jsonb(m) ->> ''name'' as name from supabase_migrations.schema_migrations m'
              else 'select null::text as version, null::text as name where false' end,
         false, false, ''))) as r
  union all
  select 10, 'HISTORY|(the table supabase_migrations.schema_migrations does not exist)'
  where to_regclass('supabase_migrations.schema_migrations') is null

  union all
  -- 2. Tables: row level security, columns (name type, "!" = not null, "=" = has a default), approximate row count
  select 20, 'TABLE|' || c.relname || '|rls=' || c.relrowsecurity::text || '|rows~' || greatest(c.reltuples, 0)::bigint::text || '|cols='
    || (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then '!' else '' end
                          || case when a.atthasdef then '=' else '' end, ', ' order by a.attnum)
        from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')

  union all
  -- 3. Functions: security definer?, who may execute, a fingerprint of the body (equal body = equal fingerprint)
  select 30, 'FUNC|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|secdef=' || p.prosecdef::text
    || '|exec=' || coalesce((select string_agg(r.rolname, ',' order by r.rolname)
                             from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')
                               and has_function_privilege(r.rolname, p.oid, 'execute')), '-')
    || '|body=' || left(md5(p.prosrc), 8)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'

  union all
  -- 4. Row level security policies
  select 40, 'POLICY|' || tablename || '|' || policyname || '|' || cmd || '|' || array_to_string(roles, ',')
    || '|using=' || coalesce(regexp_replace(qual, '\s+', ' ', 'g'), '')
    || '|check=' || coalesce(regexp_replace(with_check, '\s+', ' ', 'g'), '')
  from pg_policies where schemaname in ('public', 'storage')

  union all
  -- 5. Triggers on our tables and on auth.users
  select 50, 'TRIGGER|' || c.relname || '|' || t.tgname || '|' || p.proname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
       join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))

  union all
  -- 6. Constraints (primary/unique/foreign keys, checks)
  select 60, 'CONSTRAINT|' || conrelid::regclass::text || '|' || conname || '|' || regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g')
  from pg_constraint where connamespace = 'public'::regnamespace

  union all
  -- 7. Indexes
  select 70, 'INDEX|' || indexname || '|' || regexp_replace(indexdef, '\s+', ' ', 'g')
  from pg_indexes where schemaname = 'public'

  union all
  -- 8. Storage buckets (settings only, never the files)
  select 80, 'BUCKET|' || id || '|public=' || public::text || '|limit=' || coalesce(file_size_limit::text, '-') || '|mime=' || coalesce(array_to_string(allowed_mime_types, ','), '-')
  from storage.buckets

  union all
  -- 9. Table privileges of the three API roles
  select 90, 'GRANT|' || table_name || '|' || grantee || '|' || string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
  group by table_name, grantee
) inventory
order by section, line;
