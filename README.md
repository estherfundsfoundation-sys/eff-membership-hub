# MyEFF 2.0 — Esther Funds Foundation member home + CRM

Static HTML/JS on Supabase (shared REACH project). No build step: deploy the folder as-is (GitHub Pages, Netlify, Vercel static, or the current host).

## What changed (2.0)
- **Member home (`member.html`)** — a storytelling "road" (Called → Connected → Prepared → Serving → Leading) with the next right step; an acceptance letter that unfolds on screen and prints; the Esther Experience with real lessons, reflections and checks, plus a printable completion certificate; a service transcript (log, edit/delete while pending, approved totals); fundraising log; the EFF Passport (automatic stamps); national/chapter announcements; a private retention check-in with an **I need to REACH** flag; My Chapter with verified leaders; an opt-in member directory; Esther Light (daily verse, optional); full profile editing and notification preferences.
- **Admin (`admin.html`)** — national staff only (role-gated, RLS-enforced): dashboard stats and needs-attention list; searchable, filterable member table with CSV export; a member drawer with profile, record, roles, staff notes, check-ins, hours, fundraising and a full activity log; roster verification actions; queues for verification, REACH flags, service hours and fundraising; chapter management (add/edit/status); role assignment (chapter leaders, regional, national staff); announcements composer; Esther Light scheduler.
- **Database (`sql/2026-09-20_myeff2.sql`)** — creates the role table the old code assumed existed; adds chapters (seeded), extended profiles, review fields, staff notes, an activity log written by triggers, passport stamps with auto-award triggers, check-ins, announcements, Esther Light, a safe directory view, an admin stats RPC, and RLS on everything.
- Landing (`index.html`) now loads chapters from the database. `member-portal.html` and `staff.html` redirect to the new pages so old links and Supabase redirect URLs keep working.

## Deploy (15 minutes)
1. **Database:** in the Supabase SQL editor run, in order, `membership-hub.sql`, `membership-hub-course-staff-update.sql` (both idempotent; skip if already run), then `sql/2026-09-20_myeff2.sql`.
2. **First admin:** find the founder's user id in Authentication → Users and run
   `insert into public.eff_chapter_roles(user_id, role) values ('<id>', 'national_staff') on conflict do nothing;`
3. **Auth settings:** Authentication → URL Configuration → add `https://my.estherfundsfoundation.org/member.html` and `https://my.estherfundsfoundation.org/admin.html` to Redirect URLs. Keep the old `member-portal.html` / `staff.html` entries.
4. **Email deliverability (the #1 cause of "the login doesn't work"):** Authentication → SMTP → use a real sender (Resend, Postmark, SendGrid) on the estherfundsfoundation.org domain with SPF/DKIM. Supabase's default sender is rate-limited and lands in spam.
5. Push this branch and deploy. Nothing else on the host changes.

## Privacy and security
- The publishable key in `supabase-config.js` is public by design; **row-level security** is the boundary. Members can only read/write their own rows; staff access requires a `national_staff` role row; the directory view exposes only opted-in, public-safe fields; emails are readable only by staff or the owner via `eff_member_email()`.
- No secrets in the repo. Never add a service-role key to any client file.
- Members see only `is_staff`-safe data; the admin page is `noindex`.

## Files
```
index.html            landing (chapters from DB)
member.html  js/member.js   member home
admin.html   js/admin.js    national admin
js/core.js            shared client, auth, helpers, letter + certificate
myeff.css             member/admin styles      styles.css   landing styles
sql/2026-09-20_myeff2.sql   migration          membership-hub*.sql   original migrations (keep)
member-portal.html, staff.html   redirects
```

## Roadmap (not in this release)
Checkr integration for K–12 ambassadors, K–12 schools/programs/session logs (see MYEFF_CRM_Upgrade_Spec.md), transactional email on status changes, mentor matching, community wall, PGWS platform.
