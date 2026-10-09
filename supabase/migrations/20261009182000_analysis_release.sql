-- A Trygghetspaket report reaches its customer only after a Köpanalys reviewer has released it.
--
-- released_at: since when the customer may see this analysis. NULL = it is waiting for release.
-- released_by: the reviewer who released it (NULL for analyses released automatically, such as every
--              Områdesanalys, and for everything that existed before this migration).
--
-- Every analysis that exists when this runs was already visible to its customer, so it counts as released at
-- the moment it was completed. New analyses start unreleased (NULL): a row that is forgotten is held back, not
-- shown. The code that reads this column ships after the migration has been applied (docs/operations/database.md).
--
-- Safe to run more than once: the backfill happens only in the run that adds the columns. A later run must never
-- release analyses that are waiting for review.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'analyses' and column_name = 'released_at'
  ) then
    alter table public.analyses
      add column released_at timestamptz,
      add column released_by uuid references auth.users(id) on delete set null;

    update public.analyses
       set released_at = coalesce(completed_at, created_at);
  end if;
end
$$;

comment on column public.analyses.released_at is
  'When the customer may see this analysis. NULL = waiting for a reviewer to release it (full scope only; area analyses are released at once).';
comment on column public.analyses.released_by is
  'The reviewer who released the analysis; NULL when it was released automatically.';
