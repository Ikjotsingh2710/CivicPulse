-- CivicPulse — grant yourself the control desk.
-- Run AFTER 0001_init.sql. Idempotent; safe to re-run.
--
-- ORDER MATTERS. Register on the website FIRST (Sign in → Create account) with
-- the phone number and password you want as your admin login. That is what
-- creates the account and stores the bcrypt password hash in auth.users. This
-- file does not create an account and cannot set a password — it only promotes
-- an existing one by adding a row to admin_users, which is what /admin, the
-- adminGuard and every "admin" RLS policy check against.
--
-- Then run the whole file in the SQL Editor. Only v_ward is worth editing —
-- the name is read from the account you registered with.

do $$
declare
  -- Digits only: no spaces, no '+', no country code unless you typed one on the
  -- sign-up form. The client stores exactly what it stripped, and RLS compares
  -- it exactly, so '+91 74288 92131' here would never match.
  v_phone text := '7428892131';

  -- Display label on the dashboard header. It is NOT a permission scope: every
  -- row in admin_users sees every ticket in every ward.
  v_ward  text := 'Ward 12';

  v_user_id uuid;
  v_name    text;
begin
  if v_phone !~ '^[0-9]{10,15}$' then
    raise exception 'v_phone must be 10-15 digits with no spaces or symbols, got %', v_phone;
  end if;

  -- Fail loudly rather than creating a row that can never match a real login.
  -- A typo here is otherwise invisible: /admin would simply keep redirecting.
  select id, nullif(raw_user_meta_data ->> 'full_name', '')
    into v_user_id, v_name
  from auth.users
  where raw_user_meta_data ->> 'phone' = v_phone
  limit 1;

  if v_user_id is null then
    raise exception
      'No registered account has phone %. Sign up on the website with that exact number first, then re-run this file.',
      v_phone;
  end if;

  insert into public.admin_users (phone, full_name, ward_location)
  values (v_phone, coalesce(v_name, 'Administrator'), v_ward)
  on conflict (phone) do update
    set full_name     = excluded.full_name,
        ward_location = excluded.ward_location;

  raise notice 'Admin granted to % / % (auth user %).',
    coalesce(v_name, 'Administrator'), v_phone, v_user_id;
end
$$;

-- Who currently holds the desk. Any row in this table sees every ticket in
-- every ward — `ward_location` is a display label on the dashboard header, not
-- a scope. If this returns anyone but you, delete them:
--     delete from public.admin_users where phone <> '7428892131';
select phone, full_name, ward_location, created_at
from public.admin_users
order by created_at;
