-- Categorized failure reason, alongside the existing free-text `error`
-- column: lets the app show the right customer-facing message (currently
-- only "insufficient_data" gets the reassuring "we couldn't gather enough
-- reliable data, your credit was returned" copy) and lets a future review
-- pass filter failed analyses by cause without parsing free text.
-- `error` already carries the full technical detail for that same review —
-- this is additive, not a replacement.
alter table public.analyses
  add column if not exists failure_reason text;
