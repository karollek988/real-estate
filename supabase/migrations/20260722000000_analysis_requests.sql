-- Ownership layer: records which user requested which (shared, cached)
-- analysis and which quota bucket it drew from. Analyses/properties stay
-- shared and cached per property (see requestAnalysis() in pipeline.ts) —
-- this table never gets deleted into; deleting a user only removes their
-- rows here, never the underlying analysis/property/BRF data.
create table if not exists public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id),
  property_id uuid not null references public.properties (id),
  analysis_type text not null check (analysis_type in ('free', 'premium')),
  quota_consumed boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists analysis_requests_user_created_idx
  on public.analysis_requests (user_id, created_at desc);

alter table public.analysis_requests enable row level security;

create policy "Analysis requests are viewable by owner"
  on public.analysis_requests for select
  using (auth.uid() = user_id);

-- All writes (insert/delete) go through the service-role client from API
-- routes, same pattern as properties/analyses — no insert/delete policy for
-- the authenticated role.
grant select, insert, delete on public.analysis_requests to service_role;
