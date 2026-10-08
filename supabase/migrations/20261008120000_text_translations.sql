-- Automatic translations of the site's own content (2026-10): the articles of Bostadsguiden, Insikter and Nyheter
-- (written in Swedish in /admin/content) and the texts of listings on the map are shown in the reader's language
-- by translating them the first time they are asked for (frontend/src/lib/translate). The translation itself is done by
-- an offline, open-source model in the Python engine (api/translation.py, POST /api/translate); this table only
-- remembers the answers, so that a text is translated once and not on every visit.
--
-- One row per text and language, not per article: an article is stored as its title, its summary and one row for each
-- paragraph, heading and list item. Editing a paragraph therefore translates just that paragraph again, and the
-- same sentence in two articles is translated once. A row is found by a fingerprint of the Swedish text
-- (source_hash = sha256 of "<source language>\n<text>"), so a changed text can never get an old translation.
--
-- To translate everything again after the translator has been improved (a better model, a new glossary term):
--   truncate public.text_translations;
-- The pages translate what they show on their next rebuild (within minutes), and a published article is translated
-- again at once when the editor saves it.
--
-- Access: only the service role (the site's server) reads and writes - there is no policy for anyone else, and the
-- table is not granted to anon or authenticated. The Swedish text is kept next to its translation so that a row can
-- be read, corrected by hand (update ... set translated_text = ...) and checked; nothing here is personal data
-- except what a visitor wrote in a map listing.

create table if not exists public.text_translations (
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  target_language text not null check (char_length(target_language) between 2 and 8),
  source_language text not null default 'sv' check (char_length(source_language) between 2 and 8),
  -- The translator's own version string (api/translation.py ENGINE_VERSION): which model and glossary made this row.
  engine text not null check (char_length(engine) <= 80),
  source_text text not null check (char_length(source_text) <= 20000),
  translated_text text not null check (char_length(translated_text) <= 40000),
  created_at timestamptz not null default now(),
  primary key (source_hash, target_language)
);

alter table public.text_translations enable row level security;

revoke all on public.text_translations from anon, authenticated;
