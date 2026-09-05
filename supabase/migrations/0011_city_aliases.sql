-- CivicPulse — one name per place.
-- Run AFTER 0001_init.sql. Idempotent; safe to re-run.
--
-- THE PROBLEM
--   `ward_location` is free text on the full report form and a picked value on
--   the homepage, and the picker offered "Delhi" and "New Delhi" as separate
--   cities. Reports landed as 'New Delhi', 'New delhi' and 'Delhi' — three
--   spellings of one place. Searching any one of them found only its own third,
--   and the desk saw three regions where there is one.
--
-- THE FIX
--   Canonicalise on the way in, in the database, so it holds however the report
--   was filed — homepage picker, full form, or a tampered client. Fixing this
--   only in the frontend would leave the next client free to reintroduce it.
--
-- WHAT IS NOT TOUCHED
--   Campus names. They come from a fixed picker and never match an alias, so
--   "University of Delhi — North Campus" passes through exactly as it is.

-- ---------------------------------------------------------------------------
-- 1. Known aliases
-- ---------------------------------------------------------------------------
-- Keyed on the lower-cased spelling. Beyond the Delhi merge this also absorbs
-- the cities India renamed, which people still type the old way.

create table if not exists public.city_aliases (
  alias     text primary key,
  canonical text not null
);

insert into public.city_aliases (alias, canonical) values
  -- The merge that prompted this file.
  ('delhi',        'New Delhi'),
  ('new delhi',    'New Delhi'),
  ('ncr',          'New Delhi'),
  ('delhi ncr',    'New Delhi'),
  ('newdelhi',     'New Delhi'),
  -- Renamed cities, old names still in common use.
  ('bangalore',    'Bengaluru'),
  ('bombay',       'Mumbai'),
  ('calcutta',     'Kolkata'),
  ('madras',       'Chennai'),
  ('gurgaon',      'Gurugram'),
  ('poona',        'Pune'),
  ('baroda',       'Vadodara'),
  ('mysore',       'Mysuru'),
  ('mangalore',    'Mangaluru'),
  ('trivandrum',   'Thiruvananthapuram'),
  ('cochin',       'Kochi'),
  ('pondicherry',  'Puducherry'),
  ('simla',        'Shimla'),
  ('benares',      'Varanasi'),
  ('banaras',      'Varanasi')
on conflict (alias) do update set canonical = excluded.canonical;

-- ---------------------------------------------------------------------------
-- 2. Canonicalisation
-- ---------------------------------------------------------------------------

/**
 * The one spelling a place is stored under.
 *
 * Whitespace is squeezed first, so "new  delhi " and "New Delhi" reach the same
 * lookup. Anything with no alias is returned trimmed but otherwise untouched —
 * campus names must survive verbatim, and title-casing them would turn
 * "IIT Delhi" into "Iit Delhi".
 */
create or replace function public.canonical_ward(raw text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select a.canonical
       from public.city_aliases a
      where a.alias = lower(trim(regexp_replace(raw, '\s+', ' ', 'g')))),
    trim(regexp_replace(raw, '\s+', ' ', 'g'))
  );
$$;

create or replace function public.normalise_ward()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ward_location is not null then
    new.ward_location := public.canonical_ward(new.ward_location);
  end if;
  return new;
end;
$$;

-- Runs on update too: an admin correcting a ward by hand gets the same
-- treatment as a citizen filing one.
drop trigger if exists grievance_tickets_normalise_ward on public.grievance_tickets;
create trigger grievance_tickets_normalise_ward
  before insert or update of ward_location on public.grievance_tickets
  for each row execute function public.normalise_ward();

-- ---------------------------------------------------------------------------
-- 3. Fix what is already stored
-- ---------------------------------------------------------------------------
-- Every existing report, so the three Delhis become one. Upvote counts and
-- Pulse Points are untouched; only the label moves.

update public.grievance_tickets
   set ward_location = public.canonical_ward(ward_location)
 where ward_location is distinct from public.canonical_ward(ward_location);

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security
-- ---------------------------------------------------------------------------
-- The alias list is public reference data, like the campus list.

alter table public.city_aliases enable row level security;

drop policy if exists city_aliases_read on public.city_aliases;
create policy city_aliases_read on public.city_aliases
  for select to anon, authenticated using (true);

-- VERIFY — expect every Delhi variant collapsed into 'New Delhi'.
select ward_location, count(*) as reports
from public.grievance_tickets
group by ward_location
order by reports desc, ward_location;
