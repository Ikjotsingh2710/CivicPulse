-- CivicPulse — a phone number on every portal, and a WhatsApp where one exists.
-- Run AFTER 0017_portal_connectors.sql. Idempotent.
--
-- WHY
--   The portal is not always the right channel. A burst main at eleven at night
--   is a phone call, not a web form, and a citizen who cannot get a portal to
--   load on a weak connection still has a working phone. Three rows went in
--   with a null helpline in 0017; a null there is a dead end shown to someone
--   standing in front of a problem.
--
-- WHY WHATSAPP GETS ITS OWN COLUMN
--   Several bodies now take complaints on WhatsApp, and for a lot of people in
--   India that is the channel they will actually use — it costs nothing on a
--   metered connection, it keeps a written record, and it does not ask them to
--   register an account first. It is not a phone number pasted in a different
--   field: it opens a different app and behaves differently, so it is stored
--   and shown as its own thing.
--
-- SOURCES
--   Each number was taken from the body's own site or its verified account in
--   September 2026. Numbers change; correcting one is an UPDATE here, not a
--   redeploy, which is the reason this lives in a table at all.

-- ---------------------------------------------------------------------------
-- 1. WhatsApp, where the body publishes one
-- ---------------------------------------------------------------------------

alter table public.portal_directory
  add column if not exists whatsapp text;

comment on column public.portal_directory.whatsapp is
  'Complaint WhatsApp number, digits only, without the country code. The app '
  'builds a wa.me link from it. NULL where the body publishes none — an '
  'invented number is worse than an absent one.';

comment on column public.portal_directory.helpline is
  'Published complaint helpline. Short codes (1916, 155305) and full numbers '
  'both appear here; the app strips formatting to build the tel: link.';

-- ---------------------------------------------------------------------------
-- 2. Fill every gap, correct nothing that was already right
-- ---------------------------------------------------------------------------
-- The three nulls from 0017 were Delhi Cantonment, Pune and CPGRAMS. The rest
-- are restated so this file is the single answer to "what number do we show
-- for X?" rather than half of it.

update public.portal_directory set helpline = '155305'
  where jurisdiction = 'MCD';

update public.portal_directory set helpline = '1533', whatsapp = '8588887773'
  where jurisdiction = 'NDMC';

update public.portal_directory set helpline = '1908', whatsapp = '8130188222'
  where jurisdiction = 'PWD';

update public.portal_directory set helpline = '1916', whatsapp = '9650291021'
  where jurisdiction = 'DJB';

-- Was null. The cantonment board publishes an office line rather than a short
-- code, which is normal for a body this size.
update public.portal_directory set helpline = '011-25693837'
  where jurisdiction = 'CANTT';

update public.portal_directory set helpline = '1916'
  where jurisdiction = 'BMC';

update public.portal_directory set helpline = '080-22660000'
  where jurisdiction = 'BBMP';

update public.portal_directory set helpline = '1913', whatsapp = '9445551913'
  where jurisdiction = 'GCC';

-- Was null.
update public.portal_directory set helpline = '1800-103-0222', whatsapp = '9689900002'
  where jurisdiction = 'PMC';

-- Was null. CPGRAMS runs a helpdesk line rather than a public complaint
-- hotline — it is for trouble with the portal, which is exactly when someone
-- looking at our card needs it.
update public.portal_directory set helpline = '9540613360'
  where jurisdiction = 'CPGRAMS';

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- Expect ten rows and no dashes in the helpline column. A dash there means a
-- citizen would be shown a portal with no way to chase it by phone.
select
  jurisdiction,
  name,
  coalesce(helpline, '— MISSING —') as helpline,
  coalesce(whatsapp, '—')           as whatsapp
from public.portal_directory
where active
order by sort;
