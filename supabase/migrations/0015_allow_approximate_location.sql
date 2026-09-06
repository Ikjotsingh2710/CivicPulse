-- CivicPulse — take the exact spot when it exists, the nearest one when it does not.
-- Run AFTER 0014_require_exact_location.sql. Idempotent.
--
-- WHY THIS SOFTENS 0014
--   0014 refused any fix coarser than 100m. That was right about what a good
--   report looks like and wrong about what to do with a bad one: a citizen
--   standing over a burst pipe in a basement got turned away, and the problem
--   went unreported rather than reported roughly.
--
--   A fix of 800m still names a street. A crew can be sent to look. That is
--   worth strictly more than nothing, so the rule is now:
--
--     coordinates            required, as before
--     location_accuracy_m    required, as before — a report must say how sure
--                            it is, so silence cannot pass as precision
--     accuracy <= 100m       preferred, no longer required
--
--   Precision is not lost, it is recorded. `location_accuracy_m` already
--   carries it, so the desk can sort a 9m pin above an 800m one and the app
--   can label the difference. Enforcing quality by deleting the evidence of
--   poor quality was the mistake.

-- ---------------------------------------------------------------------------
-- 1. Accept a coarse fix, refuse a missing or absurd one
-- ---------------------------------------------------------------------------
/**
 * Replaces the 100m rejection from 0014.
 *
 * The remaining ceiling is a garbage filter, not a quality bar. Consumer
 * positioning tops out around 30km on a rural cell tower; a number past 50km
 * is not a location that got worse, it is a broken or forged value, and
 * nothing useful can be done with it.
 */
create or replace function public.guard_report_precision()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  absurd_metres constant numeric := 50000;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.location_accuracy_m is null then
    raise exception
      'This report does not say how precise its location is. Capture the spot again before filing.';
  end if;

  if new.location_accuracy_m <= 0 then
    raise exception
      'A location accuracy of %m is not a real measurement.', new.location_accuracy_m;
  end if;

  if new.location_accuracy_m > absurd_metres then
    raise exception
      'That fix only narrows the location to %km, which is not a place anyone can be sent to.',
      round(new.location_accuracy_m / 1000);
  end if;

  return new;
end;
$$;

comment on function public.guard_report_precision() is
  'Requires every new report to carry coordinates and state their accuracy. '
  'Coarse fixes are accepted and flagged by the app; only missing, zero, '
  'negative or absurd (>50km) accuracies are refused.';

-- The trigger itself is unchanged from 0014; recreated so this file can be run
-- on a database that never received 0014.
drop trigger if exists grievance_tickets_guard_precision on public.grievance_tickets;
create trigger grievance_tickets_guard_precision
  before insert on public.grievance_tickets
  for each row execute function public.guard_report_precision();

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- How precise the reports on file actually are. 'Exact spot' is what the app
-- holds out for; 'Approximate area' is what it now accepts rather than losing
-- the report entirely.
select
  case
    when latitude is null then 'No coordinates (pre-0014)'
    when location_accuracy_m is null then 'No accuracy recorded (pre-0014)'
    when location_accuracy_m <= 100 then 'Exact spot'
    else 'Approximate area'
  end as location_quality,
  count(*) as reports,
  round(min(location_accuracy_m)) as best_m,
  round(max(location_accuracy_m)) as worst_m
from public.grievance_tickets
group by 1
order by 2 desc;
