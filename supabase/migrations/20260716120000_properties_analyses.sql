-- Properties: one row per physical property, deduplicated on normalized_key
-- (normalized address + municipality + apartment number, computed by the app).
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  normalized_key text not null unique,
  address text not null,
  hemnet_url text,
  latitude double precision,
  longitude double precision,
  municipality text,
  property_type text,
  apartment_number text,
  floor integer,
  -- Extra extracted facts that don't warrant their own column yet
  -- (rooms, listing id, raw URL slug, user-entered form fields, ...).
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A Hemnet listing URL identifies exactly one property.
create unique index if not exists properties_hemnet_url_key
  on public.properties (hemnet_url)
  where hemnet_url is not null;

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- Analyses: append-only, versioned per property. Old versions are kept
-- forever so score changes can be compared over time.
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete restrict,
  version integer not null,
  engine_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'complete', 'failed')),
  decision_score integer
    check (decision_score between 0 and 100),
  -- Full analysis report as rendered to the user (see AnalysisReport in the app).
  result jsonb,
  -- Per-source outcome for this run, including whether the source is a real
  -- integration or a not-yet-connected placeholder.
  data_sources jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (property_id, version)
);

create index if not exists analyses_property_created_idx
  on public.analyses (property_id, created_at desc);

-- RLS is enabled with NO policies on purpose: only the service role (used by
-- the app's server-side pipeline and API routes) can read or write these
-- tables. Browser clients must go through the app's API.
alter table public.properties enable row level security;
alter table public.analyses enable row level security;

-- New tables are no longer auto-exposed to the Data API roles, so the service
-- role needs explicit grants. anon/authenticated get none (server-only
-- tables), and DELETE is deliberately not granted on analyses.
grant select, insert, update, delete on public.properties to service_role;
grant select, insert, update on public.analyses to service_role;

-- Analyses are permanent: block deletes at the database level, even for the
-- service role, so history can never be lost by an application bug.
create or replace function public.prevent_analysis_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'analyses are append-only and must never be deleted';
end;
$$;

create trigger analyses_prevent_delete
  before delete on public.analyses
  for each row execute function public.prevent_analysis_delete();
