# CivicPulse — File Index

Every tracked file in the repository, what it is for, and why it exists.
76 files · ~9,000 lines of TypeScript · ~1,250 lines of SQL.

Line counts are exact as of this document. Use this to find your way around;
use [SOURCE-CODE.md](SOURCE-CODE.md) to understand how the pieces fit together.

---

## Database — `supabase/`

Run these in the Supabase SQL Editor **in numerical order**. Every one is
idempotent and safe to re-run.

| File | Lines | Purpose |
|---|---:|---|
| `SETUP.md` | 163 | Step-by-step setup: project creation, running migrations, granting yourself the control desk, the Cloudinary and cron options |
| `migrations/0001_init.sql` | 221 | **Foundation.** `grievance_tickets`, `admin_users`, the `current_phone()` / `is_admin()` helpers, ticket numbering, the workflow-column guard, RLS policies, and the `ticket-photos` storage bucket |
| `migrations/0002_escalation_cron.sql` | 31 | Documents the hourly `pg_cron` job that emails a department about tickets unresolved for 24h. The Edge Function it calls is **not yet deployed** |
| `migrations/0003_feedback.sql` | 36 | `platform_feedback` — anyone may insert (including signed-out visitors), only admins may read |
| `migrations/0004_profiles.sql` | 129 | `profiles`, mirroring name and phone out of `auth.users` so joins and policies can see identity. Includes the sync trigger and a backfill. Explicitly **not** an auth table |
| `migrations/0005_grant_admin.sql` | 63 | Promotes an already-registered account to the ward desk. Aborts loudly if no account has that phone, so a typo fails visibly instead of leaving `/admin` silently redirecting |
| `migrations/0006_storage_no_listing.sql` | 52 | **Security fix.** The original policy let anyone with the publishable key *list* every photo in the bucket, not just fetch one they had a link to. Drops it and adds admin-only listing |
| `migrations/0007_reject_tickets.sql` | 119 | Adds the `Rejected` status and `rejection_reason`, extends the workflow guard to cover it, and forces every citizen-filed report to start at `Submitted` |
| `migrations/0008_pulse_points.sql` | 328 | The reward system: `campuses`, the `pulse_points` ledger, `rewards`, `reward_codes`, `redemptions`, the award trigger and the atomic `redeem_reward()` function |
| `migrations/0009_upvotes.sql` | 274 | `ticket_upvotes`, the denormalised count, the `public_tickets` view (the privacy boundary), and haversine duplicate detection |

---

## Core services — `src/app/core/`

Framework-free logic and every call to Supabase. No component talks to the
database directly.

| File | Lines | Purpose |
|---|---:|---|
| `models.ts` | 266 | Every shared type and constant — statuses, categories, urgencies, rejection reasons, description templates, ticket / profile / feedback / points / reward shapes. The single source of truth the rest of the app imports |
| `auth.service.ts` | 244 | Registration, sign-in, password change, admin lookup, and `normalisePhone` — the function whose output *is* a user's identity across the whole system |
| `tickets.service.ts` | 259 | Filing reports, the citizen's own list, the public regional feed, duplicate lookup, upvoting, and the admin workflow actions (status, category, rejection, proof) |
| `admin.service.ts` | 125 | Everything the control desk reads that is not a ticket: feedback, the citizen roster, per-person report counts, and the cross-table overview numbers |
| `points.service.ts` | 82 | Pulse Points — balance, ledger, reward catalogue, redemption. Has no `award()` method and could not have one: the browser has no write access to the ledger |
| `places.ts` | 192 | The campus and city pickers, with search that matches on institution, city, state or pincode |
| `escalation.ts` | 98 | Client-side mirror of the server's 24-hour escalation rule, so the countdown on `/escalations` matches what the cron job will actually do |
| `media.service.ts` | 63 | Photo upload. Uses Cloudinary when configured (unsigned preset, so no secret reaches the browser) and falls back to Supabase Storage otherwise |
| `institutions.ts` | 60 | The 26 campuses with coordinates and pincodes. **Must stay in sync with the `campuses` table in migration 0008** |
| `feedback.service.ts` | 40 | Platform feedback. Attaches the signed-in identity automatically and works fine without one |
| `auth.guards.ts` | 34 | `authGuard` and `adminGuard`. Convenience only — RLS is the real boundary |
| `supabase.errors.ts` | 33 | Turns opaque Postgres codes into sentences that name the fix, e.g. `PGRST205` → *"Run 0001_init.sql"* |
| `lightbox.service.ts` | 31 | Holds whichever photo is currently open full screen |
| `supabase.client.ts` | 14 | The client singleton. Publishable key only; the service-role key must never be imported from anything under `src/` |
| `auth.service.spec.ts` | 53 | Tests for phone normalisation and formatting — a tripwire, since changing that output silently orphans users from their reports |

---

## Pages — `src/app/features/`

All standalone and lazy-loaded.

| File | Lines | Route | Purpose |
|---|---:|---|---|
| `home/home-page.ts` | 1542 | `/` | The hero, animated map backdrop, campus/city picker, category picker, live capture flow and draft composer. The fast path from "I see a problem" to a filed report |
| `admin/admin-reports.ts` | 566 | `/admin` | The ticket queue — filters, status changes, category correction, rejection with reason, resolution proof upload, CSV export |
| `points/pulse-points-page.ts` | 491 | `/pulse-points` | The wallet: coin, balance, progress to the next reward, reward grid, claimed codes, full ledger |
| `report/report-page.ts` | 415 | `/report` | The full report form — urgency, department routing, description templates, duplicate check |
| `issues/issues-page.ts` | 338 | `/issues` | Public regional feed by city or pincode, with upvoting. Readable signed out |
| `profile/profile-page.ts` | 332 | `/profile` | The citizen's reports with a status trail, before/after photos, and any rejection reason |
| `admin/admin-page.ts` | 260 | `/admin` | The desk shell — overview stat strip over the three tabs |
| `escalations/escalations-page.ts` | 245 | `/escalations` | Live 24-hour countdown per unresolved ticket |
| `auth/auth-page.ts` | 243 | `/auth` | Sign in and register, phone + password, no OTP |
| `security/security-page.ts` | 242 | `/security` | Change password. Re-checks the current one, which Supabase does not require |
| `resolved/resolved-page.ts` | 239 | `/resolved` | Before-and-after proof gallery for the citizen's own closed tickets |
| `admin/admin-citizens.ts` | 206 | `/admin` | The registered-citizen roster, searchable, with report counts |
| `admin/admin-feedback.ts` | 190 | `/admin` | Platform feedback, filterable by sentiment. Read-only by design |
| `admin/csv.ts` | 41 | — | Hand-written CSV export with RFC 4180 quoting and a UTF-8 BOM so Excel does not mangle accented names |
| `admin/csv.spec.ts` | 31 | — | Tests for quote escaping, embedded commas and newlines, and null handling |

---

## Shared components — `src/app/shared/`

| File | Lines | Purpose |
|---|---:|---|
| `map-backdrop.ts` | 408 | The animated SVG map behind the hero. Hand-built, so it costs no map-tile requests |
| `camera-capture.ts` | 406 | The live-camera wizard: `getUserMedia`, review, then location consent. **No file input** — a saved photo cannot be submitted |
| `feedback-launcher.ts` | 335 | The floating feedback button and its dialog |
| `map-canvas.ts` | 228 | MapLibre canvas that recentres on the selected campus or the GPS fix |
| `duplicate-prompt.ts` | 174 | *"Already reported?"* — shows the nearby report's photo and asks whether it is the same problem. A question, never a block |
| `photo-lightbox.ts` | 153 | Full-screen photo viewer, mounted once at the app root. Closes on ✕, backdrop click or Escape |
| `photo-zoom.ts` | 52 | The `cpZoom` attribute that makes any `<img>` openable full screen, keyboard included, without touching its styling |

---

## App shell — `src/app/`

| File | Lines | Purpose |
|---|---:|---|
| `app.scss` | 507 | Navigation bar, profile popover, region search styling |
| `app.html` | 195 | The shell template — nav, profile menu with live counts, and the lightbox mount |
| `app.ts` | 119 | Nav state, popovers, region search, sign-out |
| `app.routes.ts` | 67 | Every route, its title, its guard and its lazy import |
| `app.spec.ts` | 19 | Smoke test that the shell renders |
| `app.config.ts` | 7 | Router and zoneless change detection |

---

## Entry, styling, environment — `src/`

| File | Lines | Purpose |
|---|---:|---|
| `styles.scss` | 507 | Global design tokens — the slate/emerald/amber palette, typography, and primitives (`.card`, `.pill`, `.btn-*`, `.field`, `.alert`) |
| `index.html` | 23 | The HTML shell and font loading |
| `main.ts` | 5 | Bootstrap |
| `environments/environment.ts` | 38 | Production config — Supabase URL, publishable key, the synthetic auth email domain, optional Cloudinary |
| `environments/environment.development.ts` | 18 | Same values for `ng serve`. Both must agree on `authEmailDomain`, since changing it locks out every registered user |

Both environment files are **browser-safe by design**. The publishable key is
meant to be public; RLS is what protects the data.

---

## Configuration and tooling

| File | Lines | Purpose |
|---|---:|---|
| `angular.json` | 86 | Build targets and the dev/prod environment file swap |
| `README.md` | 59 | Repository landing page (still Angular CLI boilerplate — worth replacing) |
| `.gitignore` | 49 | Keeps `node_modules`, `dist`, `.vercel` and **`.env`** out of the repository |
| `.vscode/tasks.json` | 42 | Editor tasks |
| `package.json` | 37 | Dependencies, scripts, and the Node `22.x` pin that keeps Vercel on a version Angular supports |
| `tsconfig.json` | 31 | Strict-ish compiler options shared by app and tests |
| `.env.example` | 19 | Template for local tooling. The **real** `.env` is git-ignored and holds the service-role key, which must never appear under `src/` |
| `.editorconfig` | 17 | Whitespace conventions |
| `.prettierrc` | 12 | Formatting |
| `tsconfig.app.json` / `tsconfig.spec.json` | 10 / 9 | App and test compilation scopes |
| `.claude/settings.json` | 7 | Assistant tool permissions |
| `vercel.json` | 6 | Build command, output directory, and the SPA rewrite that stops `/admin` 404-ing on refresh |
| `.vscode/extensions.json` | 4 | Recommended extensions |
| `claude/claude.md` | 112 | Working notes and conventions for AI-assisted development |
| `public/favicon.ico` | — | Site icon |

---

## Documentation — `docs/`

| File | Purpose |
|---|---|
| `SOURCE-CODE.md` | Architecture, the security model, data model, feature walkthrough, database functions, known gaps |
| `FILE-INDEX.md` | This file |
| `SIH-PRESENTATION.md` | Slide-by-slide content for the Smart India Hackathon deck |

---

## Reading order for someone new

1. **[SOURCE-CODE.md](SOURCE-CODE.md) §3** — the security model. Nothing else
   makes sense until you accept that the browser is untrusted and the database
   holds every rule.
2. **`0001_init.sql`** — the tables, the policies and the guard trigger.
3. **`core/models.ts`** — every shape the app passes around.
4. **`core/tickets.service.ts`** — the full lifecycle of a report.
5. **`0008` and `0009`** — the two features with real adversarial pressure on
   them: points and upvotes.
