-- CivicPulse — platform feedback.
-- Run AFTER 0001_init.sql; this depends on public.is_admin() from that file.
-- Idempotent; safe to re-run.

create table if not exists public.platform_feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Null when a signed-out visitor leaves feedback.
  user_phone text,
  user_name  text,
  sentiment  text check (sentiment in ('Good', 'Okay', 'Bad')),
  message    text not null check (char_length(message) between 1 and 500),
  -- Which screen they were on, so vague comments are still actionable.
  page       text
);

create index if not exists platform_feedback_created_at_idx
  on public.platform_feedback (created_at desc);

alter table public.platform_feedback enable row level security;

-- Anyone may leave feedback, signed in or not — the people most likely to have
-- something useful to say are the ones who could not get past sign-up. The
-- length check is repeated here because a policy is the only thing an
-- untrusted client cannot skip.
drop policy if exists feedback_insert_any on public.platform_feedback;
create policy feedback_insert_any on public.platform_feedback
  for insert to anon, authenticated
  with check (char_length(message) between 1 and 500);

-- Nobody reads it back from the client except an admin. Feedback is often
-- candid, and it is not a public wall.
drop policy if exists feedback_admin_read on public.platform_feedback;
create policy feedback_admin_read on public.platform_feedback
  for select to authenticated
  using (public.is_admin());
