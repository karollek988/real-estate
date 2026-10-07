-- Removes the subscription columns from profiles (Premium/Ultra monthly
-- plans, discontinued 2026-10). The app stopped reading and writing them in
-- the same change that added this file: the subscription webhook handlers,
-- the billing portal route and the "Ditt abonnemang" box are gone.
--
-- ORDER MATTERS: apply this only after that code is live on main. The
-- version before it still selects these columns in getProfileSummary, and
-- the account pages fail if they are missing.
--
-- No real subscription ever existed: on 2026-10-07 no profile had a
-- subscription_id or stripe_customer_id; the four rows with a tier were test
-- and team accounts set by hand. stripe_customer_id stays (checkout uses it).

alter table public.profiles
  drop column if exists subscription_status,
  drop column if exists subscription_tier,
  drop column if exists subscription_end,
  drop column if exists current_period_end,
  drop column if exists price_id,
  drop column if exists subscription_id;
