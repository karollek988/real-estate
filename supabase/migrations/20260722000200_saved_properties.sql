-- Minimal saved-properties table: exists so account deletion has a real
-- per-user row to remove (see 20260722000000_analysis_requests.sql's
-- comment on the ownership layer). The save/unsave UI itself is a
-- separate, later feature — not built this sprint.
create table if not exists public.saved_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id),
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

alter table public.saved_properties enable row level security;

create policy "Saved properties are viewable by owner"
  on public.saved_properties for select
  using (auth.uid() = user_id);

grant select, insert, delete on public.saved_properties to service_role;
