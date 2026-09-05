# CivicPulse — Supabase setup

Three things must be done in the Supabase dashboard. None of them can be done
from this repo: applying DDL needs a database password or the Supabase CLI, and
the auth toggle is only exposed in the dashboard.

Project: `https://nzrehjoqtlqapdeujhso.supabase.co`

---

## 1. Apply the schema — required

Studio → **SQL Editor** → **New query** → paste the entire contents of
`supabase/migrations/0001_init.sql` → **Run**.

The script is idempotent, so re-running it is safe. It creates:

- `grievance_tickets` and `admin_users`
- the indexes on `user_phone`, `status`, `ward_location`, `created_at`
- `current_phone()`, `is_admin()`, ticket-number and `updated_at` triggers
- the `guard_workflow_columns` trigger, which stops a citizen from PATCHing
  their own ticket to `Resolved` (RLS grants row access, not column access)
- all row-level security policies
- the public `ticket-photos` storage bucket

**Verify:** the table editor should list both tables, and

```
https://nzrehjoqtlqapdeujhso.supabase.co/rest/v1/grievance_tickets?select=id&apikey=<publishable key>
```

should return `[]` instead of `PGRST205 Could not find the table`.

---

## 2. Turn off "Confirm email" — required

Authentication → **Sign In / Providers** → **Email** → disable **Confirm email**
→ Save.

Citizens sign up with name + phone + password. Supabase Auth still needs an
address, so the client derives one from the phone digits
(`9876543210@citizens.civicpulse.app`). That address is deliberately
undeliverable, which breaks confirmation two ways while the toggle is on:

- `signUp()` returns a user but **no session**, so the account is created and
  immediately unusable; and
- each attempt tries to *send* a confirmation mail, and the built-in SMTP allows
  only about **two per hour** — every attempt after that fails with `429`.

**Verify:** `auth/v1/settings` should report `"mailer_autoconfirm": true`.

If you have already burned the mail quota, wait for the hour to roll over after
turning the toggle off.

---

## 3. Replace the secret key — required before Edge Functions

The `SUPABASE_SECRET_KEY` in `.env` returns `401` on both the REST and Auth
admin APIs, so it has been revoked or was copied incorrectly. Get a fresh one
from Settings → **API Keys** and replace it in `.env`.

The website itself does not use this key and works without it — only the
`escalate-tickets` Edge Function needs it. **Never** put it anywhere under
`src/`; that directory is compiled into the public browser bundle.

---

## 3.5 Profiles — recommended

Run `supabase/migrations/0004_profiles.sql` after 0001.

Authentication itself needs no tables of yours — Supabase owns `auth.users`,
which holds the hashed password, sessions and the `raw_user_meta_data` carrying
`full_name` and `phone`. This migration only *mirrors* that identity into
`public.profiles`, because `auth.users` is not readable from the browser, so
nothing can currently answer "who is 9876543210?".

A trigger on `auth.users` keeps it in step, and the migration backfills anyone
who registered earlier. Citizens read their own row, admins read all of them,
and the phone column is immutable — it is the value every RLS policy compares.

Never add a password column here.

## 4. Grant yourself the control desk

`/admin` requires a row in `admin_users` matching your phone digits. There is no
separate admin password: the desk reuses your ordinary citizen login, so the
order is always **register first, promote second**.

1. **Register on the website.** Open the app → *Sign in* → *Create account*, and
   use the phone number and password you want as your admin login. This is the
   step that creates the account; Supabase Auth stores the password as a bcrypt
   hash in `auth.users`, and nothing — not this file, not the dashboard, not the
   service-role key — can read it back.
2. **Promote that account.** Open `supabase/migrations/0005_grant_admin.sql`,
   set `v_phone`, `v_name` and `v_ward` at the top, and run the whole file in
   the SQL Editor. It refuses to insert a row if no registered account has that
   phone, so a typo fails loudly instead of leaving `/admin` silently
   redirecting.
3. **Sign out and back in.** The guard caches its `admin_users` lookup for the
   session, so an existing session will not see the new row.

Use the bare ten-digit number, with no `+91` and no leading zero.
[`normalisePhone`](../src/app/core/auth.service.ts) canonicalises what a citizen
types — `+91 74288 92131`, `07428892131` and `7428892131` all resolve to the
same identity — but it is the *canonical* form that gets stored, and RLS
compares it exactly. Numbers that are not recognisably Indian are stored as
typed.

**Every admin sees every ticket in every ward.** `ward_location` is a label on
the dashboard header, not a scope — the `admin_all_tickets` policy does not
filter by it. Keep the table to just yourself:

```sql
select * from public.admin_users;                       -- who holds the desk
delete from public.admin_users where phone <> '<yours>'; -- revoke everyone else
```

### What the desk shows

`/admin` has an overview strip and three tabs, all of them reading through the
same RLS policies rather than any privileged key:

| Tab | Source table | Actions |
| --- | --- | --- |
| Reports | `grievance_tickets` | filter, change status, upload resolution proof, export CSV |
| Feedback | `platform_feedback` | filter by sentiment, export CSV (read-only — 0003 grants admins SELECT only) |
| Citizens | `profiles` | search, per-citizen report counts, export CSV |

The link to it appears in the profile menu only when `auth.isAdmin()` is true,
so it is invisible to ordinary visitors. That is presentation, not security —
what actually protects the data is that a non-admin's queries return empty
results even if they type `/admin` directly.

---

## 4.5 Platform feedback — required for the Feedback button

Run `supabase/migrations/0003_feedback.sql` in the SQL Editor, after 0001 (it
uses `public.is_admin()` from that file).

It creates `platform_feedback`, which anyone — signed in or not — may insert
into, and only admins may read back. Until it exists, the Feedback dialog on the
homepage reports that the table is missing.

## 5. Cloudinary — optional

`MediaService` uploads to Cloudinary when
`environment.cloudinary.cloudName` and `unsignedPreset` are both set, and falls
back to the `ticket-photos` Supabase bucket otherwise. Use an **unsigned**
preset so no Cloudinary secret reaches the browser.

---

## 6. Escalation cron — optional, last

Only after the `escalate-tickets` Edge Function is deployed: fill in
`<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` in
`supabase/migrations/0002_escalation_cron.sql` and run it. It schedules an
hourly `pg_cron` job that emails the department for any unresolved ticket whose
`last_escalated_at` is more than 24 hours old.
