-- CivicPulse — the portal connector layer.
-- Run AFTER 0016_cap_approximation_at_100m.sql. Idempotent.
--
-- WHAT THIS IS FOR
--   A citizen who photographs a pothole should not then have to work out
--   whether the road belongs to MCD, PWD or the Cantonment Board, find that
--   body's portal, and retype everything they just told us. CivicPulse works
--   out the destination and hands over a complaint that is ready to paste.
--
-- WHAT THIS IS NOT
--   It is not automated submission. CivicPulse never posts to a government
--   endpoint, never touches an OTP, and never drives a government site with a
--   headless browser. The citizen submits their own complaint and passes their
--   own OTP; all we remove is the retyping. `connector_type` exists so that if
--   a body ever grants official API credentials, one new class starts using
--   them without the rest of the app changing.
--
-- WHY A TABLE AND NOT A CONSTANT
--   Portal URLs and helplines change without notice, and a wrong URL sends a
--   citizen nowhere. Holding them as data means a correction is one UPDATE
--   rather than a redeploy. The *routing* rules stay in the client, because
--   deciding a jurisdiction involves geometry rather than lookup.

-- ---------------------------------------------------------------------------
-- 1. The directory of bodies we can hand off to
-- ---------------------------------------------------------------------------

create table if not exists public.portal_directory (
  jurisdiction     text primary key,
  name             text not null,
  -- Canonical city this body serves, matching `city_aliases.canonical`.
  -- NULL means national: the fallback used when no local body is listed.
  city             text,
  web_url          text not null,
  -- Play Store or app-scheme link, where an official app exists and its
  -- identifier has been verified. NULL is the honest value otherwise.
  app_url          text,
  helpline         text,
  -- 'assisted' = prepare and hand off to the citizen (all of them, today).
  -- 'api'      = direct submission, once credentials are granted.
  connector_type   text not null default 'assisted'
                     check (connector_type in ('assisted', 'api')),
  active           boolean not null default true,
  sort             integer not null default 100
);

comment on table public.portal_directory is
  'Government bodies CivicPulse can hand a complaint to. Reference data: '
  'readable by everyone, writable only with the secret key.';

comment on column public.portal_directory.connector_type is
  'Chooses the connector implementation. Every row is ''assisted'' until a '
  'body grants official API credentials; nothing else in the app changes when '
  'one flips to ''api''.';

-- ---------------------------------------------------------------------------
-- 2. Seed: verified portals
-- ---------------------------------------------------------------------------
-- URLs confirmed against each body's own site in September 2026. `on conflict`
-- refreshes them in place so a correction can be re-run over a live database
-- without disturbing `connector_type`, which an operator may have flipped.

insert into public.portal_directory
  (jurisdiction, name, city, web_url, app_url, helpline, sort) values
  ('MCD',   'Municipal Corporation of Delhi', 'New Delhi',
   'https://mcdonline.nic.in/portal/', null, '155305', 10),

  ('NDMC',  'New Delhi Municipal Council', 'New Delhi',
   'https://www.ndmc.gov.in/complaints.aspx',
   'https://play.google.com/store/apps/details?id=com.citizen.ndmc', '1533', 20),

  ('PWD',   'PWD Delhi (Sewa)', 'New Delhi',
   'https://pwdsewa.pwddelhi.gov.in/Home/SubmitComplaint/', null, '1908', 30),

  ('DJB',   'Delhi Jal Board', 'New Delhi',
   'https://delhijalboard.delhi.gov.in/jalboard/grievance-redressal-mechanism',
   null, '1916', 40),

  ('CANTT', 'Delhi Cantonment Board', 'New Delhi',
   'https://delhi.cantt.gov.in/public-grievance-redressal/', null, null, 50),

  ('BMC',   'Brihanmumbai Municipal Corporation', 'Mumbai',
   'https://portal.mcgm.gov.in/irj/portal/anonymous/qlcomplaintreg?guest_user=english',
   null, '1916', 60),

  ('BBMP',  'Greater Bengaluru Authority (BBMP)', 'Bengaluru',
   'https://site.bbmp.gov.in/',
   'https://play.google.com/store/apps/details?id=com.nammabengaluruNew.org',
   '080-22660000', 70),

  ('GCC',   'Greater Chennai Corporation', 'Chennai',
   'https://gccservices.in/pgr',
   'https://play.google.com/store/apps/details?id=com.ceedeev.grivenancev2',
   '1913', 80),

  ('PMC',   'Pune Municipal Corporation', 'Pune',
   'https://complaint.pmc.gov.in/',
   'https://play.google.com/store/apps/details?id=in.gov.pmc.pmccare', null, 90),

  -- The catch-all. CPGRAMS reaches every central and state department, so a
  -- city with no local body listed still has somewhere real to go.
  ('CPGRAMS', 'CPGRAMS — Government of India', null,
   'https://pgportal.gov.in/Home/LodgeGrievance',
   'https://play.google.com/store/apps/details?id=nic.org.mygrievance', null, 999)
on conflict (jurisdiction) do update set
  name     = excluded.name,
  city     = excluded.city,
  web_url  = excluded.web_url,
  app_url  = excluded.app_url,
  helpline = excluded.helpline,
  sort     = excluded.sort;

-- ---------------------------------------------------------------------------
-- 3. Reference data: everyone reads, nobody writes from a browser
-- ---------------------------------------------------------------------------

alter table public.portal_directory enable row level security;

-- Signed out too: the homepage can show where a report would go before anyone
-- has an account, and there is nothing private in a published portal URL.
drop policy if exists portal_directory_read on public.portal_directory;
create policy portal_directory_read on public.portal_directory
  for select to anon, authenticated
  using (true);

-- No insert/update/delete policy of any kind. Corrections are made in Studio
-- or with the secret key, so a tampered client cannot repoint a jurisdiction
-- at a site of its own choosing.

-- ---------------------------------------------------------------------------
-- 4. Track the handoff on the ticket it belongs to
-- ---------------------------------------------------------------------------
-- Both tickets live on one row: CivicPulse's own, and the government one the
-- citizen filed. /profile shows them together, which is the whole point — a
-- citizen should not have to remember which portal they used last Tuesday.

alter table public.grievance_tickets
  add column if not exists portal_jurisdiction  text,
  add column if not exists portal_status        text not null default 'not_sent',
  add column if not exists portal_handed_off_at timestamptz,
  add column if not exists portal_reference_id  text;

comment on column public.grievance_tickets.portal_status is
  'not_sent: never handed off. awaiting_user_submission: opened with the '
  'complaint ready to paste, citizen has not confirmed. submitted: citizen '
  'came back with the portal''s reference number.';

comment on column public.grievance_tickets.portal_reference_id is
  'The complaint number the government portal issued. Typed in by the citizen '
  'after they submit — CivicPulse never reads it from the portal.';

alter table public.grievance_tickets
  drop constraint if exists grievance_tickets_portal_status;

alter table public.grievance_tickets
  add constraint grievance_tickets_portal_status
  check (portal_status in ('not_sent', 'awaiting_user_submission', 'submitted'));

-- The reminder query on /profile asks "handed off, still unconfirmed, and how
-- long ago?" — so it reads exactly these two columns and nothing else.
create index if not exists grievance_tickets_portal_pending_idx
  on public.grievance_tickets (portal_status, portal_handed_off_at)
  where portal_status = 'awaiting_user_submission';

-- ---------------------------------------------------------------------------
-- 5. Keep the handoff columns honest
-- ---------------------------------------------------------------------------
/**
 * The citizen owns these columns — they are the ones doing the submitting, and
 * only they know the reference number the portal gave them. But a status is a
 * claim about something that happened, so the two that can be checked are.
 *
 * This runs alongside guard_workflow_columns, which already reverts a
 * citizen's writes to the admin-only workflow columns.
 */
create or replace function public.guard_portal_handoff()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 'submitted' means a reference number exists. Without one there is nothing
  -- to track and nothing to show the desk, so the claim is not accepted.
  if new.portal_status = 'submitted'
     and coalesce(trim(new.portal_reference_id), '') = '' then
    raise exception
      'Marking a report submitted needs the reference number the portal gave you.';
  end if;

  -- A handoff has to name where it went, or /profile cannot link back to it
  -- and the 24-hour reminder has no portal to point at.
  if new.portal_status <> 'not_sent' and new.portal_jurisdiction is null then
    raise exception 'A handoff has to record which portal it went to.';
  end if;

  -- Stamp the time here rather than trusting a client clock, which may be
  -- wrong by hours and would make the reminder fire early or never.
  if new.portal_status = 'awaiting_user_submission'
     and old.portal_status is distinct from 'awaiting_user_submission' then
    new.portal_handed_off_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists grievance_tickets_guard_portal on public.grievance_tickets;
create trigger grievance_tickets_guard_portal
  before update on public.grievance_tickets
  for each row execute function public.guard_portal_handoff();

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- Expect ten bodies, all 'assisted', CPGRAMS last with a null city.
select jurisdiction, name, coalesce(city, '— national —') as serves,
       connector_type, coalesce(helpline, '—') as helpline
from public.portal_directory
where active
order by sort;
