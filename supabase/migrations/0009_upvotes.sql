-- CivicPulse — upvotes, the public feed, and duplicate detection.
-- Run AFTER 0007_reject_tickets.sql and 0008_pulse_points.sql. Idempotent.
--
-- THE PROBLEM THIS SOLVES
--   A pothole affecting fifty people looked exactly like one affecting nobody,
--   and both sank down the desk's list as newer reports arrived. Meanwhile the
--   same pothole got filed five separate times, so the desk worked it five
--   times and five people each expected points for it.
--
-- THE SHAPE OF THE FIX
--   One report per problem. Everyone else adds an upvote, which pushes it up
--   the desk's queue. Only the first reporter earns Pulse Points — an upvote is
--   worth nothing, which is what stops it being farmed.

-- ---------------------------------------------------------------------------
-- 1. The count, kept on the ticket
-- ---------------------------------------------------------------------------
-- Denormalised deliberately: PostgREST cannot ORDER BY an aggregate of a joined
-- table, and ordering the desk's queue by this number is the entire point.

alter table public.grievance_tickets
  add column if not exists upvote_count integer not null default 0;

create index if not exists grievance_tickets_upvote_count_idx
  on public.grievance_tickets (upvote_count desc, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Upvotes
-- ---------------------------------------------------------------------------

create table if not exists public.ticket_upvotes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id  uuid not null references public.grievance_tickets (id) on delete cascade,
  user_phone text not null,
  -- One person, one voice, per report.
  unique (ticket_id, user_phone)
);

create index if not exists ticket_upvotes_user_idx
  on public.ticket_upvotes (user_phone);

/**
 * Enforces who may upvote what.
 *
 * `user_phone` is overwritten rather than validated: the column is then simply
 * incapable of holding anyone else's number, so there is no policy to get
 * subtly wrong. Upvoting your own report is refused because a report that
 * counted its own author would let one person manufacture urgency, and a closed
 * report is refused because there is nothing left to prioritise.
 */
create or replace function public.guard_upvote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  text;
  v_status text;
begin
  new.user_phone := public.current_phone();
  if new.user_phone is null then
    raise exception 'Sign in to upvote a report.';
  end if;

  select user_phone, status into v_owner, v_status
  from public.grievance_tickets where id = new.ticket_id;

  if v_owner is null then
    raise exception 'That report no longer exists.';
  end if;

  if v_owner = new.user_phone then
    raise exception 'You cannot upvote your own report.';
  end if;

  if v_status in ('Resolved', 'Rejected') then
    raise exception 'That report is already closed.';
  end if;

  return new;
end;
$$;

drop trigger if exists ticket_upvotes_guard on public.ticket_upvotes;
create trigger ticket_upvotes_guard
  before insert on public.ticket_upvotes
  for each row execute function public.guard_upvote();

/** Keeps grievance_tickets.upvote_count equal to the number of rows here. */
create or replace function public.sync_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.grievance_tickets
       set upvote_count = upvote_count + 1
     where id = new.ticket_id;
    return new;
  end if;

  update public.grievance_tickets
     set upvote_count = greatest(0, upvote_count - 1)
   where id = old.ticket_id;
  return old;
end;
$$;

drop trigger if exists ticket_upvotes_sync_count on public.ticket_upvotes;
create trigger ticket_upvotes_sync_count
  after insert or delete on public.ticket_upvotes
  for each row execute function public.sync_upvote_count();

-- Repairs the count if this file is re-run after upvotes already exist.
update public.grievance_tickets t
   set upvote_count = (
     select count(*)::integer from public.ticket_upvotes u where u.ticket_id = t.id
   )
 where t.upvote_count is distinct from (
     select count(*)::integer from public.ticket_upvotes u where u.ticket_id = t.id
   );

-- ---------------------------------------------------------------------------
-- 3. The public feed
-- ---------------------------------------------------------------------------
/**
 * What anybody — signed in or not — may see about a report.
 *
 * The column list IS the privacy policy. `user_name` is published because
 * people should be able to see who is looking after their campus;
 * `user_phone` is not, and must never be added here. Rejected reports are
 * excluded: publishing something the desk threw out would expose a citizen's
 * mistake to everyone.
 *
 * This view is intentionally NOT `security_invoker`. It runs as its owner and
 * therefore bypasses the row-level policies on grievance_tickets, which is the
 * only way to show one citizen another citizen's report. Every column that
 * leaves here has been chosen by hand.
 */
create or replace view public.public_tickets as
select
  t.id,
  t.ticket_number,
  t.created_at,
  t.category,
  t.description,
  t.urgency,
  t.latitude,
  t.longitude,
  t.ward_location,
  t.image_url,
  t.status,
  t.upvote_count,
  t.user_name
from public.grievance_tickets t
where t.status <> 'Rejected';

grant select on public.public_tickets to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Duplicate detection
-- ---------------------------------------------------------------------------

/**
 * Metres between two coordinates. Plain haversine rather than PostGIS, so this
 * migration needs no extension — at campus distances the difference between a
 * spherical and an ellipsoidal earth is centimetres.
 */
create or replace function public.distance_metres(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
returns double precision
language sql
immutable
as $$
  select 6371000 * acos(
    least(1, greatest(-1,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$;

/**
 * The nearest open report of the same category within 75 metres, or null.
 *
 * Advisory only. This function never blocks anything — it hands the citizen a
 * candidate and the app asks whether it is the same problem. That matters:
 * two genuinely different potholes can sit forty metres apart, and a rule
 * strict enough to catch every duplicate would also silence real reports.
 *
 * Returns nothing when the new report has no geotag, because without
 * coordinates the only thing left to match on is the whole campus, and that
 * would flag every second report as a duplicate.
 */
create or replace function public.find_duplicate_ticket(
  p_category text,
  p_lat      numeric,
  p_lng      numeric
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when t.id is null then null else json_build_object(
    'id',            t.id,
    'ticket_number', t.ticket_number,
    'category',      t.category,
    'description',   t.description,
    'ward_location', t.ward_location,
    'image_url',     t.image_url,
    'status',        t.status,
    'created_at',    t.created_at,
    'upvote_count',  t.upvote_count,
    'user_name',     t.user_name,
    'distance_m',    round(public.distance_metres(p_lat, p_lng, t.latitude, t.longitude))
  ) end
  from public.grievance_tickets t
  where p_lat is not null
    and p_lng is not null
    and t.latitude is not null
    and t.longitude is not null
    and t.category = p_category
    and t.status not in ('Resolved', 'Rejected')
    -- Not your own: being shown your own report as a duplicate of itself is
    -- confusing, and you cannot upvote it anyway.
    and t.user_phone is distinct from public.current_phone()
    and public.distance_metres(p_lat, p_lng, t.latitude, t.longitude) <= 75
  order by public.distance_metres(p_lat, p_lng, t.latitude, t.longitude)
  limit 1;
$$;

grant execute on function public.find_duplicate_ticket(text, numeric, numeric)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.ticket_upvotes enable row level security;

-- You may add your own upvote. The trigger has already forced user_phone to
-- your number, so this check can only pass for rows that are genuinely yours.
drop policy if exists upvote_insert_own on public.ticket_upvotes;
create policy upvote_insert_own on public.ticket_upvotes
  for insert to authenticated
  with check (user_phone = public.current_phone());

-- You can see which reports you have upvoted, so the button can show its state.
drop policy if exists upvote_read_own on public.ticket_upvotes;
create policy upvote_read_own on public.ticket_upvotes
  for select to authenticated
  using (user_phone = public.current_phone() or public.is_admin());

-- And change your mind.
drop policy if exists upvote_delete_own on public.ticket_upvotes;
create policy upvote_delete_own on public.ticket_upvotes
  for delete to authenticated
  using (user_phone = public.current_phone());

-- NOTE — upvotes deliberately earn no Pulse Points. 0008 pays out only when a
-- report is approved, and only to the phone on the report itself. Anything that
-- paid for upvoting would be farmable in seconds.

-- VERIFY
select
  (select count(*) from public.public_tickets)  as publicly_visible,
  (select count(*) from public.ticket_upvotes)  as upvotes;
