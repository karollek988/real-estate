-- Visitor and device statistics for the admin portal's statistics page (2026-10).
--
-- Cookieless and first-party: the site's own server counts a page view when the
-- browser tells it a page was shown (POST /api/analytics/hit, see
-- frontend/src/lib/analytics). Nothing is set or read on the visitor's device,
-- and no IP address, user agent or URL is stored - not here, not anywhere.
--
-- The one thing needed to count a visitor once per day is a value that is the
-- same for the same visitor within a day and nothing else:
--
--   visitor = HMAC-SHA256(secret key, day | IP address | user agent)
--
-- The key stays on the server, the day is part of the input, so the value cannot
-- be reversed and cannot be followed from one day to the next. These values live
-- in analytics_visitor_days for two days (record_page_view deletes older rows
-- each time it runs); what is kept long term is only analytics_daily: the number
-- of visitors and page views per day and device type.
--
-- A "visitor" over several days is therefore the sum of the daily visitors: a
-- person who comes back on three days counts three times. That is the price of
-- not being able to recognise anyone across days.

create table if not exists public.analytics_visitor_days (
  day date not null,
  visitor text not null,
  primary key (day, visitor)
);

create table if not exists public.analytics_daily (
  day date not null,
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  visitors integer not null default 0 check (visitors >= 0),
  page_views integer not null default 0 check (page_views >= 0),
  primary key (day, device)
);

-- RLS on with no policies: server-only, like the other tables. The admin portal
-- reads analytics_daily with the service role; nothing is reachable from a browser.
alter table public.analytics_visitor_days enable row level security;
alter table public.analytics_daily enable row level security;

revoke all on public.analytics_visitor_days from anon, authenticated;
revoke all on public.analytics_daily from anon, authenticated;
grant select on public.analytics_daily to service_role;

-- Counts one page view. Returns nothing. A visitor's first page view of the day
-- adds one to `visitors`; every call adds one to `page_views`.
create or replace function public.record_page_view(p_day date, p_visitor text, p_device text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  new_visitor integer;
begin
  if p_device not in ('mobile', 'tablet', 'desktop') then
    raise exception 'unknown device type: %', p_device;
  end if;

  -- 1 when this visitor was not seen today, 0 when they were. The primary key
  -- makes two simultaneous first page views count once.
  insert into public.analytics_visitor_days (day, visitor)
    values (p_day, p_visitor)
    on conflict do nothing;
  get diagnostics new_visitor = row_count;

  insert into public.analytics_daily (day, device, visitors, page_views)
    values (p_day, p_device, new_visitor, 1)
    on conflict (day, device) do update
      set visitors = public.analytics_daily.visitors + excluded.visitors,
          page_views = public.analytics_daily.page_views + 1;

  -- Keep only today's and yesterday's visitor values; the daily counts are all
  -- that is needed after that.
  delete from public.analytics_visitor_days where day < p_day - 1;
end;
$$;

-- Like every other function here: callable by the server only. (Postgres grants
-- EXECUTE to PUBLIC by default, which would let anyone with the public anon key
-- inflate the numbers directly through /rest/v1/rpc.)
revoke execute on function public.record_page_view(date, text, text) from public, anon, authenticated;
grant execute on function public.record_page_view(date, text, text) to service_role;
