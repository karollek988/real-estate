-- Postal code is a core address fact (alongside municipality) that the
-- geocoding provider resolves; give it a dedicated column rather than
-- burying it in attributes.
alter table public.properties add column if not exists postal_code text;
