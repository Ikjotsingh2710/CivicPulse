-- CivicPulse — hourly escalation job.
-- Run this ONLY after the `escalate-tickets` Edge Function is deployed.
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> before executing.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('civicpulse-hourly-escalation')
where exists (
  select 1 from cron.job where jobname = 'civicpulse-hourly-escalation'
);

select cron.schedule(
  'civicpulse-hourly-escalation',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/escalate-tickets',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- The function itself should select the rows below, email each department,
-- then stamp last_escalated_at = now() on the rows it handled:
--
--   select * from public.grievance_tickets
--   where status <> 'Resolved'
--     and department_email is not null
--     and coalesce(last_escalated_at, created_at) < now() - interval '24 hours';
