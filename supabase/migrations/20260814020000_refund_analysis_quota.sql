-- Counterpart to consume_analysis_quota(): atomically credits one unit of
-- the given quota bucket back to a user's profile. Used when an analysis
-- fails to gather the essential listing fields (price, fee, rooms, living
-- area) after all retries/fallbacks — the customer shouldn't be charged for
-- a report that couldn't be generated. Returns the new remaining count.
create or replace function public.refund_analysis_quota(p_user_id uuid, p_type text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  if p_type = 'premium' then
    update public.profiles
      set premium_analyses_remaining = premium_analyses_remaining + 1
      where id = p_user_id
      returning premium_analyses_remaining into remaining;
  elsif p_type = 'free' then
    update public.profiles
      set free_analyses_remaining = free_analyses_remaining + 1
      where id = p_user_id
      returning free_analyses_remaining into remaining;
  else
    raise exception 'refund_analysis_quota: unknown analysis type %', p_type;
  end if;

  return remaining;
end;
$$;

grant execute on function public.refund_analysis_quota(uuid, text) to service_role;
