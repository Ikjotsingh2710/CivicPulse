# CLAUDE.md — CivicPulse Development Guidelines

## Answer & Behavior Style
- **Short answers by default.** Lead directly with code or actionable steps—no conversational preambles or recaps.
- Status questions ("what is the state?") get a short bulleted fact list—nothing else.
- Explain reasoning only when asked, or in one line when it changes what the user should do.
- Don't over-apologize or narrate mistakes. Correct it, state what changed in one line, and move on.
- Don't re-explain rules stated by the user back to them.

## Tech Stack & Architecture
- **Frontend Framework:** Angular 18+ (Standalone Components, Signals, Zoneless Routing)
- **Backend & Database:** Supabase (PostgreSQL for ticket records, Auth for Name+Phone+Password, Storage buckets)
- **Media Hosting:** Cloudinary API (for live photo compression & public web hosting)
- **Deployment Platform:** Vercel (Production web hosting)
- **Scheduled Jobs:** Supabase `pg_cron` + Edge Function — runs hourly, checks `last_escalated_at` vs `now()` against a 24hr threshold on unresolved tickets, sends department email reminders, updates `last_escalated_at`.

## Critical Constraints (Hard Rules)
- **NO NGMODULES:** Use Angular Standalone Components exclusively (`standalone: true`). Do not generate or import `NgModules`.
- **STATE MANAGEMENT:** Use Angular Signals (`signal()`, `computed()`) for component reactivity instead of RxJS Subject patterns where appropriate.
- **NO SCREENSHOT VERIFICATIONS:** Do not attempt to take screenshots or serve `file:///` URLs for visual checks.
- **NO OTP:** Registration and sign-in are name + phone + password only. The phone provider (SMS OTP) stays disabled. Supabase Auth needs an address, so the client derives a synthetic one from the phone digits (`9876543210@citizens.civicpulse.app`, domain in `environment.authEmailDomain`) and never shows or mails it. The domain must use a real public TLD — Supabase's validator rejects reserved TLDs like `.local` and `.test` — and an unregistered subdomain keeps it undeliverable. Changing the domain locks out every existing account, since the address *is* the auth identity.
- **RLS ENFORCEMENT:** `grievance_tickets` RLS policy restricts SELECT/UPDATE to rows where `user_phone = public.current_phone()`, and `current_phone()` reads `auth.jwt() -> 'user_metadata' ->> 'phone'` — *not* the top-level `phone` claim, which only the OTP provider populates. Admin role bypasses via a separate policy — never via client-side filtering alone.
- **SECRET KEY NEVER SHIPS:** `SUPABASE_SECRET_KEY` lives only in the git-ignored `.env` and is read by Edge Functions / tooling. Nothing under `src/` may import it — that directory is compiled into the public browser bundle.
- **ADMIN ROUTE GUARD:** `/admin` access requires a verified row in `admin_users`, checked in the route guard. A citizen account authenticating successfully is not sufficient to reach admin routes.
- **NO SELF-SERVICE ADMIN:** there is no client-side path into `admin_users`. The roster is managed from Studio or with the secret key; registration creates citizens only.

## Core System Architecture (Three Interfaces)
0. **Authentication (`/auth`):**
   - One page, two tabs: sign in (phone + password) and register (name + phone + password).
   - Phone digits are normalised (non-digits stripped) before use — this single form is the identity key across `user_metadata.phone`, `grievance_tickets.user_phone` and `admin_users.phone`.
1. **Citizen Portal (`/report`):**
   - Infrastructure damage reporting with live camera capture or drag-and-drop photo upload.
   - Auto-extraction of browser Geolocation (Latitude & Longitude).
   - Category selector (Potholes, Broken Streetlight, Waste, Water Leakage, Other).
   - Once a photo exists, pre-written description templates for the chosen category are offered (`DESCRIPTION_TEMPLATES`), plus an optional free-text description capped at `DESCRIPTION_LIMIT` (200 characters) for anything they don't cover.
   - Automatic complaint ticket ID generation (human-readable `ticket_number`, e.g. `CP-2026-00001`).
1.5. **Profile Panel (nav phone icon, not a route):**
   - Header row: full name, phone formatted for display (`formatPhone`, e.g. `+91 98765 43210`) and an emerald ● Active Session badge. Display formatting never touches the stored digits, which are the identity RLS compares.
   - Two-column mini bar: Active Complaints / Resolved, refetched on every open via `TicketsService.myCounts()`.
   - Actions: 📋 My Complaints (`/profile`), ⚡ Ticket Escalations (`/escalations`), 🖼️ Resolved Photos (`/resolved`), 🔒 Security Settings (`/security`), and the Ward Control Desk for admins.
   - Footer: 🚪 Sign Out, which clears the local Supabase token and returns to `/auth`.
2. **User Profile & Tracking (`/profile`):**
   - Personal dashboard displaying all active/closed tickets tied strictly to the logged-in user's phone number (enforced via RLS, not just query filters).
   - Visual status tracking timeline (`Submitted` ➔ `In Progress` ➔ `Resolved`), driven by `updated_at`.
   - 24-hour automated escalation trigger to send direct department email reminders if unresolved (via `pg_cron` Edge Function).
   - Viewing official "Before & After" resolution proof photos uploaded by admins.
3. **Admin Control Dashboard (`/admin`):**
   - Management login interface for campus/ward officials, restricted to `admin_users` table entries.
   - Filterable issue feed (Urgency, Submission Date, Category, Ward/Campus Location).
   - Geotagged map integration showing issue pins.
   - Status update controls (`Open` ➔ `In Progress` ➔ `Resolved`) and resolution proof photo uploader.

## Supabase Database Schema Guidelines

### Table: `grievance_tickets`
- `id`: `uuid` (default: `gen_random_uuid()`, primary key)
- `ticket_number`: `text` (unique, not null — e.g. `CP-2026-00001`)
- `created_at`: `timestamptz` (default: `now()`)
- `updated_at`: `timestamptz` (default: `now()`, updated via trigger on status change)
- `user_phone`: `text` (not null, indexed)
- `user_name`: `text` (denormalised from `user_metadata.full_name` — admins cannot read `auth.users` from the client)
- `category`: `text` (not null)
- `description`: `text`
- `urgency`: `text` (check constraint: `'Low'`, `'Medium'`, `'High'`)
- `latitude`: `numeric`
- `longitude`: `numeric`
- `ward_location`: `text` (not null, indexed)
- `image_url`: `text` (not null)
- `status`: `text` (default: `'Submitted'`, indexed, check constraint: `'Submitted'`, `'In Progress'`, `'Resolved'`)
- `resolution_image_url`: `text`
- `department_email`: `text`
- `last_escalated_at`: `timestamptz`

### Table: `profiles` (migration 0004)
- `id`: `uuid` (primary key, references `auth.users(id)` on delete cascade)
- `phone`: `text` (unique, nullable, **immutable** — enforced by the `profiles_guard_phone` trigger, since it is what every RLS policy compares)
- `full_name`: `text`
- `created_at` / `updated_at`: `timestamptz`
- Mirrors `auth.users.raw_user_meta_data` via the `on_auth_user_upserted` trigger. It is **not** an auth table: passwords and sessions belong to Supabase's `auth` schema and no password column may ever be added here.
- RLS: citizens read their own row, admins read all, name is updatable by its owner, no client insert or delete.

### Table: `admin_users`
- `id`: `uuid` (default: `gen_random_uuid()`, primary key)
- `phone`: `text` (not null, unique)
- `full_name`: `text`
- `ward_location`: `text` (not null — scopes which tickets this admin manages)
- `created_at`: `timestamptz` (default: `now()`)

### Row-Level Security
- `grievance_tickets`: citizens can SELECT/INSERT/UPDATE only where `user_phone = public.current_phone()`. Admin policy grants full access where the caller's phone exists in `admin_users` (via `public.is_admin()`, `SECURITY DEFINER` so the lookup does not recurse through `admin_users`' own policy).
- `admin_users`: SELECT of the caller's own row only; no client-side writes. Manage the roster from Studio or with the secret key.
- Indexes required on `user_phone`, `status`, `ward_location` — queried on every profile load and admin filter action.

### Storage
- Bucket `ticket-photos` (public read, authenticated write) backs `MediaService` whenever `environment.cloudinary.cloudName` is empty; Cloudinary unsigned upload is used when it is set.

## Supabase Project Setup (manual, one time)
Neither step can be done from the repo — both need dashboard access.
1. **Apply the schema:** Studio → SQL Editor → paste all of `supabase/migrations/0001_init.sql` → Run. Idempotent.
2. **Turn off "Confirm email":** Authentication → Sign In / Providers → Email. With it on, `signUp()` returns no session and the confirmation mail goes to a synthetic address that does not exist, so every registration dead-ends.
3. Optional, only after the `escalate-tickets` Edge Function is deployed: run `supabase/migrations/0002_escalation_cron.sql` with its placeholders filled in.
4. To grant admin rights: `insert into public.admin_users (phone, full_name, ward_location) values ('9876543210', 'Name', 'Ward 12');`

## Anti-Generic Design Guardrails
- **Colors:** Never use default Tailwind blue/indigo (`#3B82F6`, `#6366F1`). Use custom brand color tokens (e.g., slate/emerald/amber slate accents).
- **Interactive States:** Every button and input needs hover, focus-visible, and active states.
- **Typography:** Plus Jakarta Sans for headings (`--font-display`, weight 700–800), Inter for body and UI text (`--font-body`). Inter's tall x-height is what keeps labels, coordinates and table rows readable at small sizes. Use tight tracking (`-0.035em`) on large headings.
- **Spacing & Depth:** Use layered, color-tinted shadows with low opacity and a structural z-plane depth system (base → elevated → floating).

## Development Commands
- **Local Dev Server:** `ng serve` (Runs on `http://localhost:4200`)
- **Build Verification:** `ng build` (Run after every major feature addition to verify zero TypeScript/compilation errors)
- **Install Supabase SDK:** `npm install @supabase/supabase-js`