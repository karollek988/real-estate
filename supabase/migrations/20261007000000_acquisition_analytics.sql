-- Where new visitors come from, for the admin portal's Markov simulator (2026-10).
--
-- Unlike the visitor counting in 20261006000000_site_analytics.sql, this one uses a cookie and therefore
-- only ever runs for visitors who accepted "analys och marknadsföring" in the cookie banner. The cookie
-- (ka_src, 90 days) holds one channel and one source name, e.g. "seo.google", and nothing else: no
-- identifier, no address, no page. The visitor's browser works the channel out from the page that linked
-- here (the referrer) and the campaign tags in the address, and sends only that answer.
--
-- This file stores two things, both only as daily totals that cannot be tied to anyone:
--
--   analytics_arrivals_daily   per day, channel and source: how many new visitors (consenting ones) arrived.
--                              "New" means they had no ka_src cookie yet; a visitor who comes back with the
--                              cookie is not counted again, and one whose cookie has expired is.
--   analytics_consent_daily    per day: how many people accepted and how many declined the banner. A
--                              decline is counted without any cookie and without any identifier; it exists
--                              so the simulator can scale the consenting visitors up to everyone
--                              (new visitors ~ accepted + declined).
--
-- The channels are the simulator's five: seo, ads, social, ai, direct.

create table if not exists public.analytics_arrivals_daily (
  day date not null,
  channel text not null check (channel in ('seo', 'ads', 'social', 'ai', 'direct')),
  source text not null check (source ~ '^[a-z_]{1,24}$'),
  visitors integer not null default 0 check (visitors >= 0),
  primary key (day, channel, source)
);

create table if not exists public.analytics_consent_daily (
  day date primary key,
  accepted integer not null default 0 check (accepted >= 0),
  declined integer not null default 0 check (declined >= 0)
);

-- RLS on with no policies: server-only, like the other analytics tables.
alter table public.analytics_arrivals_daily enable row level security;
alter table public.analytics_consent_daily enable row level security;

revoke all on public.analytics_arrivals_daily from anon, authenticated;
revoke all on public.analytics_consent_daily from anon, authenticated;
grant select on public.analytics_arrivals_daily to service_role;
grant select on public.analytics_consent_daily to service_role;

-- Records one event:
--   'accept'  someone accepted the banner: counts the choice and one new visitor from p_channel / p_source
--   'arrive'  a consenting visitor without the cookie (it expired, or they cleared it): one new visitor
--   'decline' someone declined the banner: counts the choice only (p_channel and p_source are ignored)
create or replace function public.record_acquisition(p_day date, p_event text, p_channel text, p_source text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_event not in ('accept', 'arrive', 'decline') then
    raise exception 'unknown event: %', p_event;
  end if;

  if p_event in ('accept', 'arrive') then
    if p_channel is null or p_channel not in ('seo', 'ads', 'social', 'ai', 'direct') then
      raise exception 'unknown channel: %', p_channel;
    end if;
    insert into public.analytics_arrivals_daily (day, channel, source, visitors)
      values (p_day, p_channel, coalesce(p_source, 'other'), 1)
      on conflict (day, channel, source) do update
        set visitors = public.analytics_arrivals_daily.visitors + 1;
  end if;

  if p_event in ('accept', 'decline') then
    insert into public.analytics_consent_daily (day, accepted, declined)
      values (p_day, case when p_event = 'accept' then 1 else 0 end, case when p_event = 'decline' then 1 else 0 end)
      on conflict (day) do update
        set accepted = public.analytics_consent_daily.accepted + excluded.accepted,
            declined = public.analytics_consent_daily.declined + excluded.declined;
  end if;
end;
$$;

-- Server only, like record_page_view (Postgres grants EXECUTE to PUBLIC by default, which would let
-- anyone with the public anon key add to the numbers through /rest/v1/rpc).
revoke execute on function public.record_acquisition(date, text, text, text) from public, anon, authenticated;
grant execute on function public.record_acquisition(date, text, text, text) to service_role;
