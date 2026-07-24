-- Per-field provenance for properties.attributes: which provider populated
-- each field, its confidence, and when (pipeline.ts's field-provenance
-- choke point + providers/providerConfidence.ts). Needed now that a field
-- can come from more than one source at different confidence levels
-- (Hemnet's own page scrape vs. the direct Booli API vs. Parse.bot's
-- Booli.se scraper-as-a-service).
alter table public.properties
  add column if not exists field_provenance jsonb not null default '{}'::jsonb;
