-- CivicPulse — profiles.
-- Run AFTER 0001_init.sql (it uses public.is_admin() and public.current_phone()).
-- Idempotent; safe to re-run.
--
-- WHY: a citizen's name and phone live in their own JWT, which only they can
-- read. Nothing server-side or admin-side can look up "who is 9876543210?"
-- because auth.users is not reachable from the browser. This mirrors that
-- identity into a table that policies and joins can actually see.
--
-- This is NOT an authentication table. Passwords, sessions and email
-- confirmation all stay in auth.users, managed by Supabase. Never add a
-- password column here.

create table if not exists public.profiles (
  -- Same id as the auth user; deleting the account removes the profile.
  id         uuid primary key references auth.users (id) on delete cascade,
  -- Nullable so a user created outside the normal sign-up flow (no phone in
  -- their metadata) cannot break account creation. Unique when present.
  phone      text unique,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_phone_idx on public.profiles (phone);

-- ---------------------------------------------------------------------------
-- Keep it in step with auth.users
-- ---------------------------------------------------------------------------

/**
 * Copies name and phone out of the auth user's metadata.
 *
 * SECURITY DEFINER because it runs inside a trigger on auth.users, where the
 * inserting role has no rights on public.profiles. Exceptions are swallowed on
 * purpose: a failure here must never stop somebody registering, and the
 * backfill at the bottom of this file repairs anything that was missed.
 */
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, phone, full_name)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    )
    on conflict (id) do update
      set phone      = excluded.phone,
          full_name  = excluded.full_name,
          updated_at = now();
  exception
    when others then
      raise warning 'sync_profile_from_auth failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_upserted on auth.users;
create trigger on_auth_user_upserted
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Your own profile.
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (phone = public.current_phone());

-- Ward desks need to know who filed a ticket they are working.
drop policy if exists profiles_read_admin on public.profiles;
create policy profiles_read_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

-- A display name may be corrected; the phone may not. It is the identity every
-- RLS policy in this schema compares against, so changing it would orphan the
-- user from their own tickets.
drop policy if exists profiles_update_own_name on public.profiles;
create policy profiles_update_own_name on public.profiles
  for update to authenticated
  using (phone = public.current_phone())
  with check (phone = public.current_phone());

create or replace function public.guard_profile_phone()
returns trigger
language plpgsql
as $$
begin
  new.id         := old.id;
  new.phone      := old.phone;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_phone on public.profiles;
create trigger profiles_guard_phone
  before update on public.profiles
  for each row execute function public.guard_profile_phone();

-- No client INSERT or DELETE policy: rows arrive from the trigger above and
-- leave when the auth user is deleted.

-- ---------------------------------------------------------------------------
-- Backfill anyone who registered before this migration ran
-- ---------------------------------------------------------------------------

insert into public.profiles (id, phone, full_name)
select
  u.id,
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;
