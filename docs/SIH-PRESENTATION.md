# CivicPulse — SIH Presentation Content

**8 slides.** Everything your team needs to build the deck — every feature,
every screen, and what each one does.

Text in `>` blocks is a **speaker note** — say it out loud, don't put it on the
slide.

- **Live app:** https://civicpulse-black.vercel.app
- **Tagline:** *Report it once. Track it to resolved.*

---

# SLIDE 1 — Title & One-Line Pitch

**CivicPulse**
*Report it once. Track it to resolved.*

**A campus and city grievance platform where one photo becomes a tracked ticket,
the community votes on what matters most, and fixing real problems earns you
rewards.**

Fill in for SIH:
- Problem Statement ID · Title · Theme
- Category: Software
- Team Name · Team ID

> Open with the story, not the features: *"Everyone here has reported a pothole
> or a broken light and watched absolutely nothing happen. That's the problem.
> Not reporting — what happens after."*

---

# SLIDE 2 — The Problem

**Complaints go in. Nothing comes out.**

| What goes wrong | What it means for people |
|---|---|
| **Anyone can report from anywhere** | Fake and vague complaints; crews can't find the spot |
| **Newest complaint shown first** | A problem affecting 50 people sits below one affecting nobody |
| **The same problem filed 10 times** | The desk works one issue ten times over |
| **You never hear back** | You assume nobody read it, so you never report again |

**On campus it's worse — there's no system at all.** Broken streetlights,
overflowing bins and leaking taps get complained about in WhatsApp groups that
no maintenance staff member is in.

> The last row is the one that kills these apps. People don't stop reporting
> because reporting is hard. They stop because last time it vanished. Every
> feature we built exists to close that loop.

---

# SLIDE 3 — How It Works: The Citizen Journey

**Five steps, under a minute.**

```
  1. SNAP          2. AUTO-TAG        3. TRACK
  Live camera      Location +         Submitted →
  only, in-app     time captured      In Progress →
                   automatically      Resolved

  4. PROOF                     5. EARN
  Ward desk uploads an         5 Pulse Points
  "after" photo when fixed     for an approved
                               campus report
```

**The three things that make it different:**

🔒 **Live camera only** — no gallery uploads. You must physically be standing at
the problem.

📍 **Auto-geotagged** — location is captured with the photo, never typed.

✅ **Every report gets an ending** — either *Resolved with photo proof*, or
*Rejected with a written reason you can read*. Nothing silently rots.

> "Live camera only" is the line judges remember. Demo it — try to upload from
> the gallery and show that there is no button for it.

---

# SLIDE 4 — Citizen Interface (Screens 1–5)

**Nine screens. Here are the five a citizen uses most.**

**🏠 Home — Quick Report**
The whole report in one bar: pick **City or Campus** (searchable, 26 institutions
+ cities by name, state or pincode) → pick the **Issue type** (Pothole,
Streetlight, Garbage, Water Leak, Other) → **Location** locks on capture → tap
the **shutter**. Camera opens, you review the shot, confirm location, add an
optional note (with one-tap ready-made descriptions), file it.

**📝 Full Report Form**
For detailed reports: category, **urgency** (Low / Medium / High), ward or campus,
description, photo, location, and a department email for routing.

**👤 My Complaints**
Every report you've filed with a **live status trail** — Submitted → In Progress
→ Resolved — plus before/after photos, and if it was rejected, the exact reason
the ward desk gave.

**🔍 Issues by Region**
Search **any city or pincode** and see every reported problem there — photo,
category, description, status, date, and who reported it. **Works without an
account.** Each has an ▲ button to say "I have this problem too."

**🖼 Resolved Photos**
A before-and-after gallery proving what actually got fixed.

> Also built: **Escalation tracker** (live 24-hour countdown per open ticket),
> **Security settings** (change password), and a **full-screen photo viewer** on
> every image in the app — tap any photo to inspect the damage properly.

---

# SLIDE 5 — Ward Control Desk (Admin Interface)

**One dashboard where the maintenance desk runs everything.**

**Overview strip — the numbers at a glance:**
Total reports · Submitted · In Progress · Resolved · Rejected · **Open over 24h**
(turns red) · Citizens registered · Feedback received

**Three tabs:**

**📋 Reports** — the work queue
- Filter by status, urgency, category, ward or date
- **Sorted by how many people are affected**, not by date
- Change status · **Correct a wrong category** · Upload the resolution photo
- **Reject with a reason** the citizen will read
- Reopen anything rejected by mistake
- **Export to CSV**

**💬 Feedback** — what people say about the app itself, filterable by
Good / Okay / Bad, exportable

**👥 Citizens** — the registered roster, searchable, showing how many reports each
person filed and how many are still open, exportable

> Two decisions worth mentioning: rejection **always** requires a reason — it's a
> separate button, not a dropdown option, so a report can never be closed without
> an explanation. And the desk can **fix a wrong category** instead of rejecting,
> because a genuine complaint filed under the wrong label is still a genuine
> complaint.

---

# SLIDE 6 — Community Power: Upvotes & No Duplicates

**The feature that decides what gets fixed first.**

**▲ "I have this problem too"**
Browse your region, find a problem you're also affected by, tap ▲. That report
climbs the ward desk's queue. **A problem affecting 20 people now outranks one
filed five minutes ago.**

**Smart duplicate detection**
When you try to report something already reported nearby, CivicPulse shows you
that existing report's photo and asks:

> ### *"Already reported?"*
> *Someone reported this 40m from here.*
> **[ Yes — this is the same problem ]  [ No, mine is different ]**

- **Yes** → your voice is added to the existing report. No duplicate created.
- **No** → your report files normally.

**Why we ask instead of blocking:** two genuinely different potholes can sit 40
metres apart. Silently refusing the second one would lose a real complaint and
the person would never come back.

**The result:** one problem = one ticket, with an accurate count of how many
people it affects.

> Fairness rules built in: you can't upvote your own report, you can't upvote
> twice, and you can't upvote something already closed.

---

# SLIDE 7 — Pulse Points: Rewards for Real Reporting

**Civic participation that pays.**

**🪙 Earn:** 5 Pulse Points every time the ward desk **approves** one of your
campus reports.
**10 approved reports = 50 points.**

**🎁 Redeem:**

| 50 Points | 100 Points |
|---|---|
| ₹100 Amazon voucher | ₹250 Amazon voucher |
| ₹100 Flipkart voucher | Spotify Premium — 3 months |
| Spotify Premium — 1 month | Apple Music — 3 months |

Spend 50 and your balance returns to zero — or hold out for a bigger reward at
100.

**The Pulse Points screen** shows a gold coin with your balance, a progress bar
to your next reward *("15 more points — about 3 more approved reports")*, the
reward grid, your claimed voucher codes, and a full history of every point
earned and spent.

**🛡 Why it can't be farmed — the key design decision:**

> **Points are paid on approval, not on upload.**
>
> Every rewarded reporting app gets gamed within a week because it pays the
> moment you submit a photo. Ours pays only when a **human at the ward desk
> accepts the report as real**. Junk earns nothing, no matter what gets past the
> camera. Rejected reports earn nothing. Upvoting earns nothing. Only city
> problems that actually get fixed put points in your account.

Also: campus reports only, one payout per report ever, and every point is a
permanent record you can audit.

---

# SLIDE 8 — Impact, Status & Roadmap

**✅ Built and live right now — not a mockup**
👉 **civicpulse-black.vercel.app** *(add a QR code here)*

Working today: registration with phone + password (no OTP) · live camera capture
with geotag · full report workflow · rejection with reasons · ward control desk
with 3 tabs and CSV export · public regional search · upvoting · duplicate
detection · Pulse Points and redemption · escalation countdown · photo viewer ·
in-app feedback

**📈 Impact**

| Who | What changes |
|---|---|
| **Students & residents** | Problems get fixed, and you see the proof |
| **Ward & campus desks** | Work what affects the most people, not the newest |
| **Municipal departments** | Fewer duplicate dispatches; auto-escalation after 24h |
| **Environment** | Faster waste and water-leak response |

**How we'll measure it:** time from report to resolution · % closed with photo
proof · duplicate rate · and the one that matters — **do people report a second
time?**

**💰 Costs ₹0 to run.** No SMS charges (no OTP), no maps API, free hosting and
database. A campus can adopt it without a budget approval.

**🔜 Next**
Password recovery · automated escalation emails · voucher partnerships to stock
real codes · trust levels for proven reporters · integration with municipal
systems

> End on the repeat-reporter metric. Every civic app can show reports filed.
> Almost none can show people **coming back** — and that's the only proof the
> loop is actually closed.

---

# APPENDIX — For the team building the deck

## Complete feature checklist

**Reporting** — live camera only · auto-geotag · 5 categories · 3 urgency levels
· 26 campuses + city search by name/state/pincode · one-tap description templates
· 200-character limit · quick report and detailed form

**Tracking** — ticket numbers (CP-2026-00001) · 4 statuses · live status trail ·
before/after photos · rejection reasons shown to the citizen · 24-hour escalation
countdown · full-screen photo viewer

**Community** — public regional feed (no account needed) · upvoting · duplicate
detection and merging · priority sorting by people affected

**Rewards** — 5 points per approved campus report · 6 rewards at 50 and 100
points · progress tracking · voucher code delivery · full points history

**Admin** — overview stats · filterable report queue · status and category
editing · resolution photo upload · rejection with reasons · reopen · citizen
roster · feedback inbox · CSV export on all three tabs

**Accounts** — phone + password, no OTP · change password · works signed out for
browsing and feedback

## Screenshots to capture

1. Home screen with the report bar
2. Camera capture in progress
3. "Already reported?" duplicate prompt
4. My Complaints with a status trail
5. Ward Control Desk showing the report queue with upvote badges
6. Pulse Points wallet with the coin and progress bar
7. Issues by Region with ▲ buttons

## Slide-design rules

- Max ~6 lines of text per slide — detail goes in your mouth, not on screen
- One screenshot per slide minimum; this is a visual product
- Use the app's colours: deep green `#04241a`, emerald `#0f7a5a`, gold `#c8a65b`
- Put a QR code to the live site on Slide 8 so judges open it themselves

## 3-minute demo order

1. Home → pick campus + category → shutter → file a report
2. Second phone → same problem nearby → **"Already reported?"** → tap Yes
3. Admin → show it ranked by people affected → move to In Progress
4. Back to citizen → **Pulse Points: +5**

**Record this as a video beforehand.** Never demo live without a fallback.
