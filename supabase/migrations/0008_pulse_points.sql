-- CivicPulse — Pulse Points.
-- Run AFTER 0001_init.sql and 0007_reject_tickets.sql. Idempotent.
--
-- HOW IT WORKS
--   A citizen earns 5 Pulse Points when the ward desk approves one of their
--   campus reports — that is, when it leaves 'Submitted' for 'In Progress' or
--   'Resolved'. Filing earns nothing; only a human accepting the report does.
--   Rewards cost 50 or 100 points and deduct on redemption.
--
-- WHY IT IS ALL SERVER-SIDE
--   Points are worth money, so every rule that decides who gets them lives in
--   the database where a tampered client cannot reach it. The browser has no
--   INSERT policy on any table here: points arrive from a trigger, redemptions
--   go through one SECURITY DEFINER function, and the voucher-code pool is not
--   readable from the client at all.
--
-- THE LEDGER, NOT A BALANCE COLUMN
--   Every award and every spend is an append-only row. A balance is the sum of
--   those rows, so it can always be explained, and a bug can never silently
--   inflate a number nobody can audit.

-- ---------------------------------------------------------------------------
-- 1. Which wards are campuses
-- ---------------------------------------------------------------------------
-- Only campus reports earn points. `ward_location` is free text, so the server
-- needs its own list to check against — a client claiming "IIT Delhi" for a
-- city pothole must not be taken at its word.
--
-- KEEP IN SYNC with INSTITUTIONS in src/app/core/institutions.ts. If a campus
-- is added there and not here, its reports simply earn nothing.

create table if not exists public.campuses (
  name text primary key
);

insert into public.campuses (name) values
  ('Delhi Technological University'),
  ('Netaji Subhas University of Technology'),
  ('Indraprastha Institute of Information Technology'),
  ('Jawaharlal Nehru University'),
  ('University of Delhi — North Campus'),
  ('University of Delhi — South Campus'),
  ('Jamia Millia Islamia'),
  ('Guru Tegh Bahadur Institute of Technology'),
  ('IIT Delhi'),
  ('IIT Bombay'),
  ('IIT Madras'),
  ('IIT Kanpur'),
  ('IIT Roorkee'),
  ('BITS Pilani'),
  ('Manipal Institute of Technology'),
  ('VIT Vellore'),
  ('SRM Institute of Science and Technology'),
  ('Anna University'),
  ('Osmania University'),
  ('Savitribai Phule Pune University'),
  ('Jadavpur University'),
  ('Banaras Hindu University'),
  ('Aligarh Muslim University'),
  ('Panjab University'),
  ('Christ University'),
  ('RV College of Engineering')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 2. The ledger
-- ---------------------------------------------------------------------------

create table if not exists public.pulse_points (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_phone text not null,
  -- Which report earned this. Null for a redemption.
  ticket_id  uuid references public.grievance_tickets (id) on delete cascade,
  -- Positive to award, negative to spend. Never zero.
  delta      integer not null check (delta <> 0),
  reason     text not null
);

create index if not exists pulse_points_user_phone_idx
  on public.pulse_points (user_phone, created_at desc);

-- The anti-double-award guarantee. A ticket can be reopened and re-approved
-- any number of times; this index means it can only ever pay out once.
create unique index if not exists pulse_points_one_award_per_ticket
  on public.pulse_points (ticket_id)
  where ticket_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Rewards and their code pool
-- ---------------------------------------------------------------------------

create table if not exists public.rewards (
  key         text primary key,
  title       text not null,
  description text,
  cost        integer not null check (cost > 0),
  active      boolean not null default true,
  sort        integer not null default 0
);

insert into public.rewards (key, title, description, cost, sort) values
  ('amazon-100',   'Amazon voucher',        '₹100 gift card, delivered as a code.',        50,  1),
  ('flipkart-100', 'Flipkart voucher',      '₹100 gift card, delivered as a code.',        50,  2),
  ('spotify-1m',   'Spotify Premium',       'One month of Premium, delivered as a code.',  50,  3),
  ('amazon-250',   'Amazon voucher',        '₹250 gift card, delivered as a code.',       100,  4),
  ('spotify-3m',   'Spotify Premium',       'Three months of Premium.',                   100,  5),
  ('apple-3m',     'Apple Music',           'Three months of Apple Music.',               100,  6)
on conflict (key) do nothing;

/**
 * Real voucher codes, stocked by whoever runs the programme.
 *
 * This table is deliberately unreadable from the browser — no SELECT policy is
 * created for it below. A citizen sees only the single code attached to their
 * own redemption, never the pool. Redemption claims the oldest unclaimed code;
 * if there is none, the redemption is still recorded and marked 'Pending' so
 * the points are spent and the debt to the citizen is on the books.
 */
create table if not exists public.reward_codes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reward_key text not null references public.rewards (key) on delete cascade,
  code       text not null,
  claimed_by text,
  claimed_at timestamptz
);

create index if not exists reward_codes_unclaimed_idx
  on public.reward_codes (reward_key, created_at)
  where claimed_by is null;

create table if not exists public.redemptions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_phone text not null,
  reward_key text not null references public.rewards (key),
  -- Copied, not joined: what it cost that day must not change if the price does.
  cost       integer not null,
  code       text,
  status     text not null default 'Pending'
               check (status in ('Pending', 'Issued'))
);

create index if not exists redemptions_user_phone_idx
  on public.redemptions (user_phone, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Earning
-- ---------------------------------------------------------------------------

/**
 * Awards 5 points the first time a campus report is approved.
 *
 * "Approved" means a human at the ward desk moved it out of 'Submitted'. This
 * is the whole anti-gaming design: filing pays nothing, so a junk report earns
 * nothing no matter what slips past the camera, and rejecting one costs the
 * reporter the points they never received.
 *
 * SECURITY DEFINER because the citizen whose UPDATE fires this has no INSERT
 * rights on pulse_points — and must not have any.
 */
create or replace function public.award_pulse_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  points_per_report constant integer := 5;
begin
  if old.status = 'Submitted'
     and new.status in ('In Progress', 'Resolved')
     and exists (select 1 from public.campuses c where c.name = new.ward_location)
  then
    -- ON CONFLICT covers the reopen-and-approve-again path; the unique index on
    -- ticket_id is what actually makes a second award impossible.
    insert into public.pulse_points (user_phone, ticket_id, delta, reason)
    values (new.user_phone, new.id, points_per_report,
            'Report ' || new.ticket_number || ' approved')
    on conflict (ticket_id) where ticket_id is not null do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists grievance_tickets_award_points on public.grievance_tickets;
create trigger grievance_tickets_award_points
  after update of status on public.grievance_tickets
  for each row execute function public.award_pulse_points();

-- ---------------------------------------------------------------------------
-- 5. Spending
-- ---------------------------------------------------------------------------

create or replace function public.pulse_balance()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
  from public.pulse_points
  where user_phone = public.current_phone();
$$;

/**
 * Spends points on a reward, atomically.
 *
 * Everything happens in one transaction: check the balance, claim a code, write
 * the redemption, write the negative ledger row. A client cannot do these
 * separately — there is no INSERT policy on any of these tables — so there is
 * no window in which points are spent without a reward, or a reward issued
 * without points.
 *
 * The advisory lock serialises redemptions per phone number. Without it, two
 * requests fired together could both read a balance of 50 and both spend it.
 */
create or replace function public.redeem_reward(p_reward_key text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone   text := public.current_phone();
  v_reward  public.rewards%rowtype;
  v_balance integer;
  v_code    text;
  v_status  text;
begin
  if v_phone is null then
    raise exception 'Sign in before redeeming a reward.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_phone));

  select * into v_reward from public.rewards where key = p_reward_key and active;
  if not found then
    raise exception 'That reward is not available.';
  end if;

  select coalesce(sum(delta), 0) into v_balance
  from public.pulse_points where user_phone = v_phone;

  if v_balance < v_reward.cost then
    raise exception 'This reward costs % Pulse Points and you have %.',
      v_reward.cost, v_balance;
  end if;

  -- SKIP LOCKED so two people redeeming at once take different codes rather
  -- than queueing behind each other.
  update public.reward_codes
     set claimed_by = v_phone, claimed_at = now()
   where id = (
     select id from public.reward_codes
      where reward_key = p_reward_key and claimed_by is null
      order by created_at
      limit 1
      for update skip locked
   )
  returning code into v_code;

  v_status := case when v_code is null then 'Pending' else 'Issued' end;

  insert into public.redemptions (user_phone, reward_key, cost, code, status)
  values (v_phone, p_reward_key, v_reward.cost, v_code, v_status);

  insert into public.pulse_points (user_phone, ticket_id, delta, reason)
  values (v_phone, null, -v_reward.cost, 'Redeemed ' || v_reward.title);

  return json_build_object(
    'status',  v_status,
    'code',    v_code,
    'title',   v_reward.title,
    'spent',   v_reward.cost,
    'balance', v_balance - v_reward.cost
  );
end;
$$;

grant execute on function public.redeem_reward(text) to authenticated;
grant execute on function public.pulse_balance() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.campuses      enable row level security;
alter table public.pulse_points  enable row level security;
alter table public.rewards       enable row level security;
alter table public.reward_codes  enable row level security;
alter table public.redemptions   enable row level security;

-- The campus list and the reward catalogue are public information.
drop policy if exists campuses_read on public.campuses;
create policy campuses_read on public.campuses
  for select to anon, authenticated using (true);

drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards
  for select to anon, authenticated using (true);

-- Your own ledger, or everyone's if you run the desk.
drop policy if exists pulse_points_read_own on public.pulse_points;
create policy pulse_points_read_own on public.pulse_points
  for select to authenticated
  using (user_phone = public.current_phone() or public.is_admin());

drop policy if exists redemptions_read_own on public.redemptions;
create policy redemptions_read_own on public.redemptions
  for select to authenticated
  using (user_phone = public.current_phone() or public.is_admin());

-- reward_codes gets NO policy at all: RLS is on and nothing matches, so the
-- pool is invisible to every client. Only redeem_reward(), which runs as
-- definer, can touch it. Stock it from the SQL Editor:
--   insert into public.reward_codes (reward_key, code) values ('amazon-100', 'XXXX-YYYY-ZZZZ');

-- No INSERT/UPDATE/DELETE policy exists on pulse_points or redemptions either.
-- Points can only come from the trigger and the redeem function.

-- VERIFY
select
  (select count(*) from public.campuses) as campuses,
  (select count(*) from public.rewards)  as rewards,
  public.pulse_balance()                 as your_balance;
