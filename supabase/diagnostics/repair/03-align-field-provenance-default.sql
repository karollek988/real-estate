-- STEP 3 of 3 - one column default. Run on production by Karol on 2026-10-09.
--
-- 20260723000000_property_field_provenance.sql says: field_provenance jsonb not null default '{}'. Production had the
-- column and it is NOT NULL, but it had NO default (the inventory showed "jsonb!" where the migration gives "jsonb!=").
-- That was not harmless: insertProperty (frontend/src/lib/analysis/store.ts) creates a property row without
-- field_provenance - only updateProperty sets it later - so a new property would be refused by the NOT NULL check.
-- This puts back the default the migration promises. Changes no data. Safe to run more than once.

alter table public.properties alter column field_provenance set default '{}'::jsonb;

select column_default from information_schema.columns
where table_schema = 'public' and table_name = 'properties' and column_name = 'field_provenance';
