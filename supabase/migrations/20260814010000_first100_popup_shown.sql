-- Tracks whether a campaign-enrolled user has already been shown the
-- "you got 50% off coupons" popup on first dashboard login, so it only
-- ever appears once per account regardless of device/browser.
alter table public.campaign_enrollments
  add column if not exists popup_shown_at timestamptz;

-- Marks the popup as shown for the calling user. security definer +
-- explicit p_user_id check (rather than relying on RLS) mirrors the other
-- campaign functions in this file's predecessor migration — callers must
-- still verify the session belongs to p_user_id before invoking this.
create or replace function public.mark_campaign_popup_shown(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.campaign_enrollments
    set popup_shown_at = now()
    where user_id = p_user_id and popup_shown_at is null;
end;
$$;

grant execute on function public.mark_campaign_popup_shown(uuid) to service_role;
