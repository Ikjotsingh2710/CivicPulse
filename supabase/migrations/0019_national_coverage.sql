-- CivicPulse — coverage for the rest of India.
-- Run AFTER 0018_portal_helplines.sql. Idempotent.
--
-- THE SHAPE OF THE PROBLEM
--   India has 28 states, 8 union territories and some four thousand urban
--   local bodies. Enumerating every municipal portal is neither possible to
--   verify nor useful: most are unmaintained, and a wrong URL is worse than no
--   URL because it sends a citizen somewhere that cannot help them.
--
--   State grievance portals are the right unit. Every state runs one, each
--   covers every district within it, and there are roughly thirty rather than
--   four thousand. One row buys a whole state.
--
-- COVERAGE WAS ALREADY COMPLETE
--   CPGRAMS is connected to every ministry and every state, so before this
--   file no report anywhere in India lacked a destination. What these rows add
--   is *speed*: a Bihar complaint reaching Bihar's own system goes to the
--   people who fix it, rather than through a national router first.
--
-- ONLY VERIFIED URLS
--   Every address below was confirmed against the body's own site or the
--   National Portal of India in September 2026. Several large states — Punjab,
--   Telangana, Andhra Pradesh, West Bengal, Karnataka, Tamil Nadu — are
--   deliberately absent: their portals could not be verified to that standard
--   in the time available, and CPGRAMS still covers them. Adding one later is
--   an INSERT, not a deployment.

-- ---------------------------------------------------------------------------
-- 1. A body can serve a state rather than a single city
-- ---------------------------------------------------------------------------

alter table public.portal_directory
  add column if not exists state text;

comment on column public.portal_directory.state is
  'State this body serves, matching the name OpenStreetMap returns for a fix. '
  'Set on state grievance portals; NULL on city corporations, which are found '
  'by `city` instead, and on CPGRAMS, which is national.';

-- ---------------------------------------------------------------------------
-- 2. State grievance portals
-- ---------------------------------------------------------------------------
-- `sort` places these after the city corporations: a local body should always
-- be offered ahead of the state system that sits above it.

insert into public.portal_directory
  (jurisdiction, name, city, state, web_url, app_url, helpline, sort) values
  ('MH-STATE', 'Aaple Sarkar — Maharashtra', null, 'Maharashtra',
   'https://grievances.maharashtra.gov.in', null, null, 200),

  ('UP-STATE', 'Jansunwai (IGRS) — Uttar Pradesh', null, 'Uttar Pradesh',
   'https://jansunwai.up.nic.in', null, '1076', 210),

  ('BR-STATE', 'Lok Shikayat — Bihar', null, 'Bihar',
   'https://lokshikayat.bihar.gov.in', null, '18003456284', 220),

  ('RJ-STATE', 'Rajasthan Sampark', null, 'Rajasthan',
   'https://sampark.rajasthan.gov.in', null, '181', 230),

  ('MP-STATE', 'CM Helpline — Madhya Pradesh', null, 'Madhya Pradesh',
   'https://cmhelpline.mp.gov.in', null, '181', 240),

  ('GJ-STATE', 'SWAGAT — Gujarat', null, 'Gujarat',
   'https://swagat.gujarat.gov.in', null, null, 250),

  ('KL-STATE', 'CM Grievance Cell — Kerala', null, 'Kerala',
   'https://cmo.kerala.gov.in', null, '1076', 260),

  ('OD-STATE', 'Janasunani — Odisha', null, 'Odisha',
   'https://janasunani.odisha.gov.in/grievance-details', null, null, 270),

  ('HR-STATE', 'Haryana Grievance Redressal', null, 'Haryana',
   'https://grs.ulbharyana.gov.in', null, '1800-8900-929', 280),

-- ---------------------------------------------------------------------------
-- 3. Municipal corporations for the largest remaining cities
-- ---------------------------------------------------------------------------

  ('GHMC', 'Greater Hyderabad Municipal Corporation', 'Hyderabad', null,
   'https://www.ghmc.gov.in/', null, '040-21111111', 100),

  ('KMC', 'Kolkata Municipal Corporation', 'Kolkata', null,
   'https://www.kmcgov.in/', null, null, 110),

  ('AMC', 'Ahmedabad Municipal Corporation', 'Ahmedabad', null,
   'http://www.amccrs.com/AMCPortal/View/ComplaintRegistration.aspx', null, '155303', 120)

on conflict (jurisdiction) do update set
  name     = excluded.name,
  city     = excluded.city,
  state    = excluded.state,
  web_url  = excluded.web_url,
  app_url  = excluded.app_url,
  helpline = excluded.helpline,
  sort     = excluded.sort;

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- Expect 22 rows: 9 Delhi-and-metro city bodies, 3 more city corporations,
-- 9 state portals, and CPGRAMS last as the national catch-all.
select
  jurisdiction,
  name,
  coalesce(city, state, '— national —') as serves,
  coalesce(helpline, '—')               as helpline,
  connector_type
from public.portal_directory
where active
order by sort;
