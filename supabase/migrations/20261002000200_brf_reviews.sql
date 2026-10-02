-- BRF analyses are reviewed by a person before the customer sees them
-- (2026-10). Everything else in the report — the area analysis, the risk
-- chapter, the property facts — is automatic and shown at once; the BRF
-- analysis is published here by a Köpanalys reviewer, within 24 hours of the
-- purchase (see frontend/src/lib/brf/reviews.ts and /admin/brf).
--
-- One row per property: the association's figures belong to the property's
-- housing association, and every customer who owns the full analysis of the
-- property sees the same published review.
--
--   status 'pending'        a review is due (first review, or a newer annual
--                           report arrived after an earlier publication — the
--                           earlier published figures stay visible meanwhile)
--   status 'published'      `published` holds what customers see
--   status 'not_applicable' the home has no housing association
--
-- `draft` is the reviewer's working copy; publishing copies it to `published`.
-- Both hold the shape of BrfFigures (frontend/src/lib/brf/figures.ts).

create table if not exists public.brf_reviews (
  property_id uuid primary key references public.properties (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'published', 'not_applicable')),
  -- The annual report currently under review (null until one is uploaded).
  brf_report_id uuid references public.brf_annual_reports (id) on delete set null,
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  published_report_id uuid references public.brf_annual_reports (id) on delete set null,
  -- Start of the current review round and the time the customer was promised.
  requested_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '24 hours'),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brf_reviews_status_due_idx on public.brf_reviews (status, due_at);

-- RLS on with no policies: server-only, like properties/analyses/brf_annual_reports.
alter table public.brf_reviews enable row level security;
grant select, insert, update on public.brf_reviews to service_role;

-- The automatic extraction now also reads the mandatory key figures straight
-- from the annual report's flerårsöversikt, as a starting point for the
-- reviewer (never shown to a customer as-is).
alter table public.brf_annual_reports add column if not exists key_figures jsonb;

-- The reviewer opens the uploaded annual report from the review console
-- (a signed URL created server-side); nothing else changes for the bucket.
