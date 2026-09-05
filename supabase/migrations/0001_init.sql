-- CivicPulse — initial schema
-- Run in Supabase Studio → SQL Editor. Idempotent; safe to re-run.
--
-- AUTH MODEL (no OTP):
--   Users register with name + phone + password. The client calls
--   supabase.auth.signUp() with a synthetic email derived from the phone
--   (<digits>@civicpulse.local) and stores the real identity in user metadata:
--       { full_name: '...', phone: '<digits>' }
--   So the phone claim used by RLS lives at
--       auth.jwt() -> 'user_metadata' ->> 'phone'
--   NOT at auth.jwt() ->> 'phone' (that claim is only populated by the phone
--   provider, which needs SMS OTP and is deliberately disabled).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,
  full_name     text,
  ward_location text not null,
  created_at    timestamptz not null default now()
);

create sequence if not exists public.ticket_number_seq;

create table if not exists public.grievance_tickets (
  id                   uuid primary key default gen_random_uuid(),
  ticket_number        text not null unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  user_phone           text not null,
  user_name            text,
  category             text not null,
  description          text,
  urgency              text not null default 'Medium'
                         check (urgency in ('Low', 'Medium', 'High')),
  latitude             numeric,
  longitude            numeric,
  ward_location        text not null,
  image_url            text not null,
  status               text not null default 'Submitted'
                         check (status in ('Submitted', 'In Progress', 'Resolved')),
  resolution_image_url text,
  department_email     text,
  last_escalated_at    timestamptz
);

-- Re-runs on an older copy of this schema pick up the added column.
alter table public.grievance_tickets add column if not exists user_name text;
alter table public.admin_users       add column if not exists full_name text;

-- ---------------------------------------------------------------------------
-- 2. Indexes (every profile load and admin filter hits these)
-- ---------------------------------------------------------------------------

create index if not exists grievance_tickets_user_phone_idx
  on public.grievance_tickets (user_phone);
create index if not exists grievance_tickets_status_idx
  on public.grievance_tickets (status);
create index if not exists grievance_tickets_ward_location_idx
  on public.grievance_tickets (ward_location);
create index if not exists grievance_tickets_created_at_idx
  on public.grievance_tickets (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

-- The phone the client wrote into user metadata at sign-up.
create or replace function public.current_phone()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'phone', '');
$$;

-- SECURITY DEFINER so the admin lookup bypasses admin_users' own RLS,
-- which would otherwise recurse when evaluated inside a policy.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a
    where a.phone = public.current_phone()
  );
$$;

-- CP-<year>-<5 digit counter>, e.g. CP-2026-00001
create or replace function public.set_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'CP-' || to_char(now(), 'YYYY') || '-' ||
                         lpad(nextval('public.ticket_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

-- RLS grants row access, not column access: without this a citizen could PATCH
-- their own ticket straight to 'Resolved'. Workflow columns are admin-only, so
-- a non-admin's writes to them are silently reverted to the stored values.
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
  end if;
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists grievance_tickets_set_number on public.grievance_tickets;
create trigger grievance_tickets_set_number
  before insert on public.grievance_tickets
  for each row execute function public.set_ticket_number();

-- Named to sort before the touch trigger so the reverted status is what the
-- updated_at WHEN clause is evaluated against.
drop trigger if exists grievance_tickets_guard_workflow on public.grievance_tickets;
create trigger grievance_tickets_guard_workflow
  before update on public.grievance_tickets
  for each row execute function public.guard_workflow_columns();

drop trigger if exists grievance_tickets_touch_updated_at on public.grievance_tickets;
create trigger grievance_tickets_touch_updated_at
  before update on public.grievance_tickets
  for each row
  when (old.status is distinct from new.status)
  execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.grievance_tickets enable row level security;
alter table public.admin_users       enable row level security;

-- Citizens: only their own rows, matched on the metadata phone.
drop policy if exists citizen_select_own on public.grievance_tickets;
create policy citizen_select_own on public.grievance_tickets
  for select to authenticated
  using (user_phone = public.current_phone());

drop policy if exists citizen_insert_own on public.grievance_tickets;
create policy citizen_insert_own on public.grievance_tickets
  for insert to authenticated
  with check (user_phone = public.current_phone());

-- Citizens may edit their own ticket. Column-level protection of the workflow
-- fields is enforced by grievance_tickets_guard_workflow, not by this policy.
drop policy if exists citizen_update_own on public.grievance_tickets;
create policy citizen_update_own on public.grievance_tickets
  for update to authenticated
  using (user_phone = public.current_phone())
  with check (user_phone = public.current_phone());

-- Admins: full access, verified server-side against admin_users.
drop policy if exists admin_all_tickets on public.grievance_tickets;
create policy admin_all_tickets on public.grievance_tickets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- admin_users: a caller may read only their own row (this is what the route
-- guard queries). No client-side insert/update/delete at all — manage the
-- roster from Studio or with the secret (service-role) key.
drop policy if exists admin_read_self on public.admin_users;
create policy admin_read_self on public.admin_users
  for select to authenticated
  using (phone = public.current_phone());

-- ---------------------------------------------------------------------------
-- 6. Storage bucket for ticket photos
--    Used when Cloudinary is not configured (see environment.cloudinary).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('ticket-photos', 'ticket-photos', true)
on conflict (id) do update set public = true;

drop policy if exists ticket_photos_public_read on storage.objects;
create policy ticket_photos_public_read on storage.objects
  for select to public
  using (bucket_id = 'ticket-photos');

drop policy if exists ticket_photos_auth_write on storage.objects;
create policy ticket_photos_auth_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-photos');
