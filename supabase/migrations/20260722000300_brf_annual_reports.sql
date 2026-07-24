-- Shared, deduplicated BRF annual report storage. One row per uploaded PDF;
-- reused across properties/users for the same housing association (matched
-- by organization_number when known, or the uploading property as a
-- fallback grouping key), and never re-stored if byte-identical to an
-- existing report (content_hash unique).
create table if not exists public.brf_annual_reports (
  id uuid primary key default gen_random_uuid(),
  organization_number text,
  fallback_property_id uuid references public.properties (id),
  content_hash text not null unique,
  storage_path text not null,
  original_filename text,
  fiscal_year integer,
  -- Same shape as attributes.brf_annual_report (see brfAcquisition.ts /
  -- BRFProfile.to_analysis_input()) — calculate_metrics()-ready JSON.
  annual_report jsonb not null,
  -- Informational only: deleting the uploading user must never delete a
  -- report other users/properties may still be reusing.
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '365 days')
);

create index if not exists brf_annual_reports_org_number_idx
  on public.brf_annual_reports (organization_number)
  where organization_number is not null;

create index if not exists brf_annual_reports_fallback_property_idx
  on public.brf_annual_reports (fallback_property_id)
  where fallback_property_id is not null;

alter table public.brf_annual_reports enable row level security;

-- RLS enabled with NO policies on purpose, same pattern as
-- properties/analyses: only the service role (upload route + provider
-- glue) may read/write this table.
grant select, insert, update on public.brf_annual_reports to service_role;
