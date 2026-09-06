-- CivicPulse — every report carries the exact spot it was taken from.
-- Run AFTER 0013_private_photos.sql. Idempotent.
--
-- WHY
--   A report with no coordinates gives the desk the name of a city and nothing
--   else. It cannot be dispatched, cannot be checked for duplicates, and cannot
--   be verified — which makes it indistinguishable from one filed from a sofa.
--   The app now refuses to file without a fix; this is the half a tampered
--   client cannot skip.
--
-- WHAT "EXACT" MEANS
--   GPS outdoors lands at 5-20m and in a street between buildings at 20-60m.
--   Past roughly a hundred metres the fix came from wifi or a cell tower and
--   describes a neighbourhood. `location_accuracy_m` records which kind of fix
--   it was, so the desk can see how far it can trust the pin.
--
-- EXISTING ROWS ARE LEFT ALONE
--   The constraint is added NOT VALID, so the one report already filed without
--   coordinates stays readable and workable. Everything filed from now on must
--   carry them.

-- ---------------------------------------------------------------------------
-- 1. Record how precise the fix was
-- ---------------------------------------------------------------------------

alter table public.grievance_tickets
  add column if not exists location_accuracy_m numeric;

comment on column public.grievance_tickets.location_accuracy_m is
  'Radius of the GPS fix in metres at capture. Under ~100m is a real satellite '
  'fix; larger values came from wifi or cell towers and locate a neighbourhood.';

-- ---------------------------------------------------------------------------
-- 2. Require coordinates on everything filed from now on
-- ---------------------------------------------------------------------------
-- NOT VALID means Postgres enforces this on every INSERT and UPDATE without
-- re-checking rows that already exist. That is deliberate: CP-2026-00003 was
-- filed before the app required a fix, and deleting a genuine garbage report
-- to satisfy a constraint would be the wrong trade.

alter table public.grievance_tickets
  drop constraint if exists grievance_tickets_has_location;

alter table public.grievance_tickets
  add constraint grievance_tickets_has_location
  check (latitude is not null and longitude is not null)
  not valid;

-- Coordinates that are not coordinates: a swapped pair, a zeroed sensor, or a
-- hand-typed number. Enforced for everyone, old rows included, because no
-- existing row violates it.
alter table public.grievance_tickets
  drop constraint if exists grievance_tickets_sane_coordinates;

alter table public.grievance_tickets
  add constraint grievance_tickets_sane_coordinates
  check (
    (latitude is null or latitude between -90 and 90)
    and (longitude is null or longitude between -180 and 180)
  );

-- ---------------------------------------------------------------------------
-- 3. Reject a fix too coarse to act on
-- ---------------------------------------------------------------------------
/**
 * Runs alongside the existing insert guard rather than replacing it.
 *
 * A citizen cannot file a report whose fix is wider than the block it is on.
 * Null accuracy is allowed only for rows that also predate this migration —
 * a new report has to say how precise it is, so "no accuracy" cannot become
 * the way to smuggle a coarse one through.
 */
create or replace function public.guard_report_precision()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  limit_metres constant numeric := 100;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.location_accuracy_m is null then
    raise exception
      'This report has no location accuracy. Capture the spot again before filing.';
  end if;

  if new.location_accuracy_m > limit_metres then
    raise exception
      'That fix is only accurate to %m. A report needs %m or better — move outdoors and try again.',
      round(new.location_accuracy_m), limit_metres;
  end if;

  return new;
end;
$$;

drop trigger if exists grievance_tickets_guard_precision on public.grievance_tickets;
create trigger grievance_tickets_guard_precision
  before insert on public.grievance_tickets
  for each row execute function public.guard_report_precision();

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- Expect: the one pre-existing report without coordinates, and nothing else.
select ticket_number, ward_location, latitude, longitude, location_accuracy_m
from public.grievance_tickets
where latitude is null or longitude is null
order by created_at;
