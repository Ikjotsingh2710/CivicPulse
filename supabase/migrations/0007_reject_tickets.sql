-- CivicPulse — let the ward desk reject a report.
-- Run AFTER 0001_init.sql. Idempotent; safe to re-run.
--
-- WHY
-- Until now a report could only move Submitted → In Progress → Resolved. A
-- photo that shows nothing reportable — a face, a wall, the wrong issue
-- entirely — had nowhere to go, so the only way to clear it was to mark it
-- "Resolved", which quietly claims the ward fixed something it never touched.
-- Rejection is a fourth, terminal state that closes a ticket honestly and
-- records why, so the citizen is told rather than left guessing.
--
-- This matters more once reports earn points: "Resolved" must mean a real
-- issue was really fixed, or the reward is being paid out on junk.

-- ---------------------------------------------------------------------------
-- 1. The new status and its reason
-- ---------------------------------------------------------------------------

-- The CHECK was created inline in 0001, so Postgres named it for us.
alter table public.grievance_tickets
  drop constraint if exists grievance_tickets_status_check;

alter table public.grievance_tickets
  add constraint grievance_tickets_status_check
  check (status in ('Submitted', 'In Progress', 'Resolved', 'Rejected'));

alter table public.grievance_tickets
  add column if not exists rejection_reason text;

-- ---------------------------------------------------------------------------
-- 2. Keep the workflow columns admin-only
-- ---------------------------------------------------------------------------

/**
 * Replaces the 0001 version, adding two things.
 *
 * `rejection_reason` joins the admin-only set: RLS grants row access, not
 * column access, so without this a citizen could PATCH their own ticket and
 * erase the reason it was rejected — or write a flattering one.
 *
 * The reason is also cleared whenever the status is anything but 'Rejected',
 * which keeps a re-opened ticket from carrying a stale explanation. That part
 * applies to admins too: it is data hygiene, not a permission.
 */
create or replace function public.guard_workflow_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status               := old.status;
    new.resolution_image_url := old.resolution_image_url;
    new.last_escalated_at    := old.last_escalated_at;
    new.ticket_number        := old.ticket_number;
    new.user_phone           := old.user_phone;
    new.rejection_reason     := old.rejection_reason;
  end if;

  if new.status is distinct from 'Rejected' then
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

/**
 * Every citizen-filed report starts at 'Submitted'.
 *
 * The insert policy checks which rows you may add, not which values you may put
 * in them, so before this a tampered client could file a ticket already marked
 * 'Resolved' — trivially gaming any reward that pays on resolution, and never
 * appearing in the desk's queue. Admins are exempt so they can still backfill.
 */
create or replace function public.guard_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status           := 'Submitted';
    new.rejection_reason := null;
    new.last_escalated_at := null;
    new.resolution_image_url := null;
  end if;

  return new;
end;
$$;

-- Runs before the ticket-number trigger; both are BEFORE INSERT and neither
-- depends on the other's output.
drop trigger if exists grievance_tickets_guard_new on public.grievance_tickets;
create trigger grievance_tickets_guard_new
  before insert on public.grievance_tickets
  for each row execute function public.guard_new_ticket();

-- ---------------------------------------------------------------------------
-- 3. Stop rejected tickets being escalated
-- ---------------------------------------------------------------------------
-- The hourly job in 0002 emails the department for anything not yet Resolved.
-- A rejected report is closed, so chasing a department about it would be worse
-- than useless. Whoever writes the `escalate-tickets` Edge Function must use:
--
--   where status not in ('Resolved', 'Rejected')
--     and department_email is not null
--     and coalesce(last_escalated_at, created_at) < now() - interval '24 hours';

-- VERIFY — expect four allowed statuses and a rejection_reason column.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'grievance_tickets'
  and column_name in ('status', 'rejection_reason')
order by column_name;
