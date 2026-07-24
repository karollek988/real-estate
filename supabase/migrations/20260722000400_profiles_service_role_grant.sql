-- The original profiles migration only set up RLS policies for the
-- authenticated role (owner-scoped select/update via the user's own
-- session) — it never granted service_role table privileges, because
-- nothing read profiles through the admin client before now. The new
-- profile summary/quota endpoints (getProfileSummary,
-- consume_analysis_quota's underlying table) read and update profiles via
-- the service-role admin client, same pattern as properties/analyses.
grant select, update on public.profiles to service_role;
