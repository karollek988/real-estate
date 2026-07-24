-- Add unlocked column to analysis_requests for paywall support.
-- Default true so existing rows (all paid via quota or free-tier) stay as-is.
alter table public.analysis_requests add column if not exists unlocked boolean not null default true;
