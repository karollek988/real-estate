-- Cap new signups to 3 Free / 0 Premium; backfill existing rows to match.

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
    0,
    3
  );
  return new;
end;
$$;

-- One-time blanket cap applied to every existing user.
-- WARNING: this caps ALL users, including any who may have legitimately
-- purchased Premium credits before this migration shipped. A human should
-- confirm this trade-off is intended before deploying.
update public.profiles set premium_analyses_remaining = 0 where premium_analyses_remaining > 0;
update public.profiles set free_analyses_remaining   = least(free_analyses_remaining, 3) where free_analyses_remaining > 3;
