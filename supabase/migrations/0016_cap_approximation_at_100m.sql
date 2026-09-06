-- CivicPulse — nothing further than a hundred metres from the problem.
-- Run AFTER 0015_allow_approximate_location.sql. Idempotent.
--
-- WHERE THIS LANDS
--   0014 accepted only fixes under 100m and refused everything else outright.
--   0015 accepted almost anything and labelled the poor ones. Neither was
--   right: the first threw away real reports, the second let a report claim a
--   location it did not have.
--
--   The rule now has three tiers, and only the middle one is new:
--
--     <= 30m    exact. A pin. A crew walks straight to it.
--     <= 100m   approximate. The right block. Filed, and labelled as such
--               everywhere it is shown, so it is never mistaken for a pin.
--     > 100m    refused. A hundred metres is about a city block; past that a
--               crew is searching a neighbourhood, which tells them no more
--               than the ward name already did.
--
--   So a citizen indoors is still given a fallback — they just cannot file a
--   dot on the map that nobody should trust.

-- ---------------------------------------------------------------------------
-- 1. Bring the ceiling down from 50km to 100m
-- ---------------------------------------------------------------------------
/**
 * The client already refuses to submit past the ceiling and shows the citizen
 * how far off it got. This is the same rule stated where it cannot be edited
 * out of the page, which is the only place a rule is actually enforced.
 *
 * Admins stay exempt: the desk sometimes files on a citizen's behalf from a
 * phone call, where the location comes from the caller rather than the device.
 */
create or replace function public.guard_report_precision()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ceiling_metres constant numeric := 100;
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

  if new.location_accuracy_m > ceiling_metres then
    raise exception
      'That fix is only accurate to %m. A report has to land within %m of the problem — move outdoors and try again.',
      round(new.location_accuracy_m), ceiling_metres;
  end if;

  return new;
end;
$$;

comment on function public.guard_report_precision() is
  'Requires every new report to carry coordinates accurate to 100m or better. '
  'Fixes at or under 30m are exact; 30-100m are filed and labelled '
  'approximate; anything coarser is refused as untrustworthy.';

-- Unchanged from 0014/0015; recreated so this file stands alone.
drop trigger if exists grievance_tickets_guard_precision on public.grievance_tickets;
create trigger grievance_tickets_guard_precision
  before insert on public.grievance_tickets
  for each row execute function public.guard_report_precision();

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- Expect the three pre-existing reports under the 'pre-0014' labels, and
-- nothing over 100m ever appearing in this list again.
select
  case
    when latitude is null then 'No coordinates (pre-0014)'
    when location_accuracy_m is null then 'No accuracy recorded (pre-0014)'
    when location_accuracy_m <= 30 then 'Exact spot (<=30m)'
    when location_accuracy_m <= 100 then 'Approximate (30-100m)'
    else 'Over the ceiling — should not exist'
  end as location_quality,
  count(*) as reports,
  round(min(location_accuracy_m)) as best_m,
  round(max(location_accuracy_m)) as worst_m
from public.grievance_tickets
group by 1
order by 2 desc;
