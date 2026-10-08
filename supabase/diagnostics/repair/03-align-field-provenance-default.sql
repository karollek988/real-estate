-- STEP 3 of 3 (optional) - one column default.
--
-- 20260723000000_property_field_provenance.sql says: field_provenance jsonb not null default '{}'. Production has the
-- column and it is NOT NULL, but it has NO default (the inventory shows "jsonb!" where the migration gives "jsonb!="). The
-- app always sends a value when it has one (frontend/src/lib/analysis/store.ts), so nothing is broken today, but a
-- property row inserted without it would be refused. This puts back the default the migration promises.
-- Changes no data. Safe to run more than once.

alter table public.properties alter column field_provenance set default '{}'::jsonb;

select column_default from information_schema.columns
where table_schema = 'public' and table_name = 'properties' and column_name = 'field_provenance';
