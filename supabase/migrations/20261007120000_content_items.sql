-- Kunskap content (2026-10): the guides of Bostadsguiden (/bostadsguider),
-- the insights (/insikter) and our own news (/nyheter), written and published
-- from the editor at /admin/content instead of in the source code.
--
-- One table for all three types; `type` decides where an item lives. The body
-- is Markdown - a small subset, rendered without any HTML pass-through (see
-- frontend/src/lib/content/markdown.ts).
--
-- Access:
--   * Anyone (anon, authenticated) may READ an item that is published and whose
--     publication time has come - that is all the public pages need, and they
--     read with the anon key, so a draft can never reach a visitor even if the
--     site's code forgot a filter. Only the public columns are granted: who
--     created or changed an item is not readable from the browser.
--   * Nobody but the service role may WRITE. The editor's API routes use the
--     service role after checking that the signed-in user is a Köpanalys admin
--     (frontend/src/lib/auth/admin.ts, KOPANALYS_ADMIN_EMAILS) - the same model
--     as the BRF review console. Only drafts are ever deleted (the editor asks
--     for an item to be unpublished first).
--
-- Pictures: an item's picture is either one of the site's own files ("/images/...")
-- or a picture uploaded from the editor into the public Storage bucket
-- "content-images" (created below). Uploads are re-encoded on the server and
-- written with the service role; there are no Storage policies for anyone else,
-- so the public can read a picture by its address but not list or write the bucket.
--
-- Nothing is deleted here, and no existing table changes.

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('guide', 'insight', 'news')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 3 and 160),
  excerpt text not null default '' check (char_length(excerpt) <= 320),
  body text not null default '' check (char_length(body) <= 100000),
  -- One of the Bostadsguiden subjects (frontend/src/lib/content/model.ts).
  category text check (category in ('kopa-bostad', 'brf-ekonomi', 'omraden', 'risker', 'kostnader')),
  -- A picture served by the site itself ("/images/...") or uploaded to a
  -- Supabase bucket "content-images" (hosted, or the local stack in development) -
  -- the site checks it is this project's own bucket.
  cover_image text check ((cover_image ~ '^/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp|avif)$' or cover_image ~ '^(https://[a-z0-9-]+\.supabase\.co|http://(127\.0\.0\.1|localhost):[0-9]+)/storage/v1/object/public/content-images/[A-Za-z0-9_.-]+\.(jpe?g|png|webp|avif)$') and cover_image !~ '\.\.'),
  cover_image_alt text not null default '' check (char_length(cover_image_alt) <= 200),
  author_name text not null default 'Köpanalys' check (char_length(author_name) between 1 and 80),
  reading_minutes integer check (reading_minutes between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  published_at timestamptz,
  -- Search and sharing. Empty means: use the title, the excerpt, the item's own
  -- address and the cover picture.
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  canonical_url text check (canonical_url ~ '^https://' and char_length(canonical_url) <= 300),
  social_image text check ((social_image ~ '^/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp|avif)$' or social_image ~ '^(https://[a-z0-9-]+\.supabase\.co|http://(127\.0\.0\.1|localhost):[0-9]+)/storage/v1/object/public/content-images/[A-Za-z0-9_.-]+\.(jpe?g|png|webp|avif)$') and social_image !~ '\.\.'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  unique (type, slug),
  -- A published item always has a publication time.
  check (status = 'draft' or published_at is not null)
);

create index if not exists content_items_published_idx
  on public.content_items (type, published_at desc)
  where status = 'published';

-- updated_at follows every change (public.set_updated_at() is defined in
-- 20260716000000_profiles.sql).
drop trigger if exists content_items_set_updated_at on public.content_items;
create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;

revoke all on public.content_items from anon, authenticated;
grant select (
  id, type, slug, title, excerpt, body, category, cover_image, cover_image_alt, author_name,
  reading_minutes, status, featured, published_at, updated_at, seo_title, seo_description,
  canonical_url, social_image
) on public.content_items to anon, authenticated;
grant select, insert, update, delete on public.content_items to service_role;

drop policy if exists "Published content is readable by everyone" on public.content_items;
create policy "Published content is readable by everyone"
  on public.content_items for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

-- Uploaded pictures: public read by address, at most 5 MB, WebP only (the server
-- re-encodes every upload to WebP before storing it).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-images', 'content-images', true, 5242880, array['image/webp'])
on conflict (id) do nothing;
