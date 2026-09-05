-- CivicPulse — push new reports to the ward desk the moment they arrive.
-- Run AFTER 0001_init.sql. Idempotent; safe to re-run.
--
-- WHY
--   The desk should not have to refresh to find out that somebody reported a
--   burst pipe. Adding grievance_tickets to Supabase's realtime publication
--   makes Postgres broadcast every INSERT to subscribed clients, which is what
--   drives the toast and the badge on the Control Desk link.
--
-- WHO RECEIVES IT
--   Realtime honours Row-Level Security, so a citizen subscribing to this
--   channel receives only rows they could already read — their own. Only an
--   admin, whose `admin_all_tickets` policy covers every row, gets told about
--   other people's reports. Enabling this widens nothing.
--
-- IF THIS IS NEVER RUN
--   Nothing breaks. The app also polls every 45 seconds, so the badge stays
--   correct and the desk is still notified — just up to 45 seconds later
--   instead of instantly. Realtime is the fast path, not the only path.

do $$
begin
  -- Supabase creates this publication on every project, but a self-hosted
  -- instance may not have it, and adding a table twice is an error.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename  = 'grievance_tickets'
    ) then
      alter publication supabase_realtime add table public.grievance_tickets;
      raise notice 'grievance_tickets added to supabase_realtime.';
    else
      raise notice 'grievance_tickets was already published. Nothing to do.';
    end if;
  else
    raise notice 'No supabase_realtime publication here; the app will poll instead.';
  end if;
end
$$;

-- VERIFY — expect one row naming grievance_tickets.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename = 'grievance_tickets';
