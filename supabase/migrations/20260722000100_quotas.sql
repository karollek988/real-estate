-- Per-user analysis quotas, tracked on profiles. New signups get 10 Premium
-- + 3 Free analyses; consumption happens through consume_analysis_quota(),
-- an atomic check-and-decrement so concurrent requests can't both succeed
-- against the last unit of quota.
alter table public.profiles add column if not exists premium_analyses_remaining integer not null default 0;
alter table public.profiles add column if not exists free_analyses_remaining integer not null default 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, premium_analyses_remaining, free_analyses_remaining)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    10,
    3
  );
  return new;
end;
$$;

-- Atomically decrements one unit of the given quota bucket and returns the
-- new remaining count, or no row if the bucket was already at 0. Callers
-- must treat "no row returned" as quota-exhausted.
create or replace function public.consume_analysis_quota(p_user_id uuid, p_type text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  if p_type = 'premium' then
    update public.profiles
      set premium_analyses_remaining = premium_analyses_remaining - 1
      where id = p_user_id and premium_analyses_remaining > 0
      returning premium_analyses_remaining into remaining;
  elsif p_type = 'free' then
    update public.profiles
      set free_analyses_remaining = free_analyses_remaining - 1
      where id = p_user_id and free_analyses_remaining > 0
      returning free_analyses_remaining into remaining;
  else
    raise exception 'consume_analysis_quota: unknown analysis type %', p_type;
  end if;

  return remaining;
end;
$$;

grant execute on function public.consume_analysis_quota(uuid, text) to service_role;
