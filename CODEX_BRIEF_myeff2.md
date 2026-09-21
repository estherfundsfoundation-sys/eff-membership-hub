# MyEFF 2.0 — Brief for Codex

**Repo:** https://github.com/estherfundsfoundation-sys/eff-membership-hub (branch `main`)
**Live:** https://my.estherfundsfoundation.org
**Package:** `MyEFF_2.0.zip` (complete repo) or `MyEFF_2.0.patch` (git patches on top of commit `391f418`)
**Owner:** Esther Funds Foundation. MyEFF is the collegiate member portal and CRM. It is a separate program from EFF K–12; nothing here touches K–12.

## 1. What to do
1. Apply the package to `main`: either `git am MyEFF_2.0.patch` from a fresh clone, or replace the working tree with the zip contents and commit. Do not rewrite any file; the package is final.
2. Deploy exactly as the site deploys today (static files; no build step; no framework).
3. Supabase (shared REACH project, SQL editor):
   - Run `membership-hub.sql` and `membership-hub-course-staff-update.sql` if they have never been run (safe to re-run).
   - Run `sql/2026-09-20_myeff2.sql` (idempotent).
   - Insert the founder as the first admin: `insert into public.eff_chapter_roles(user_id, role) values ('<auth.users.id>','national_staff');`
   - Authentication → URL configuration: Site URL `https://my.estherfundsfoundation.org`; add `https://my.estherfundsfoundation.org/member.html` and `.../admin.html` to Redirect URLs. Consider OTP expiry 3600s.
4. Confirm `eff-logo.png` exists at the site root (the footer uses `myeff-mark.svg`; the nav uses `myeff-logo.svg`, both included).

## 2. What's in the package
- `index.html` — professional portal homepage: top bar, MyEFF logo, sign-in panel in the hero, story band, what's inside, membership path, chapter directory (from DB with static fallback), resources, Esther 4:14 band, footer. `index_story.html` and `index_legacy.html` are kept for reference only; do not link them.
- `member.html` + `js/member.js` — member home: road progress, acceptance letter, Esther Experience (8 modules + certificate), service transcript, fundraising, passport stamps, chapter & leaders, directory, retention check-in with "I need to REACH", Esther Light, profile & preferences.
- `admin.html` + `js/admin.js` — national staff admin: stats, member table + filters + CSV, member drawer (record, actions, notes, check-ins, activity), queues (roster, REACH flags, hours, fundraising), chapters CRUD, roles, announcements, Esther Light scheduler.
- `js/core.js`, `myeff.css`, `myeff-logo.svg`, `myeff-mark.svg`, `supabase-config.js` (publishable key only).
- `sql/2026-09-20_myeff2.sql` — the migration (chapters, roles, extended profiles, review fields, notes, activity log via triggers, passport stamps, check-ins, announcements, Esther Light, directory view, admin stats RPC, RLS).
- `member-portal.html`, `staff.html` — redirects to the new pages so old links keep working.
- `README.md` — deploy and security notes.

## 3. Rules
- Client-side only; the only server is Supabase. Never add a secret key to any file.
- Do not weaken any RLS policy. Members write only their own rows and only while `pending`; status changes are staff-only.
- No analytics or third-party scripts beyond Google Fonts, supabase-js (jsdelivr), and Supabase itself.
- Keep every external link exactly as written.

## 4. Acceptance
- [ ] `index.html` loads; chapter directory shows database chapters (17 + 2 PGWS); sign-in from the hero sends a magic link.
- [ ] New email → `member.html` → onboarding → acceptance letter appears; module completes; hours submit as pending.
- [ ] Founder account opens `admin.html`; a non-staff account is refused with the message.
- [ ] Admin: verify a member → member's road shows "Connected"; approve hours → member's passport shows "First service approved"; activity log shows both.
- [ ] `member-portal.html` and `staff.html` redirect.
- [ ] No console errors on any page; no request other than Supabase, jsdelivr, and Google Fonts.
