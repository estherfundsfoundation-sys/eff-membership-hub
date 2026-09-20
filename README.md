# MyEFF 2.0 — Esther Funds Foundation member home + CRM

Static HTML/JS on Supabase (shared with REACH). No build step. Deploy by copying the files.

## What's here
| File | Purpose |
| --- | --- |
| `index.html` + `app.js` + `styles.css` | Public landing (chapters now load from the database; hardcoded list is the fallback) |
| `member.html` + `js/member.js` | Member home: the road, acceptance letter, Esther Experience (8 modules + certificate), service transcript, fundraising, EFF Passport, chapter & leaders, directory, retention check-in with "I need to REACH", Esther Light, profile & preferences |
| `admin.html` + `js/admin.js` | National staff admin: dashboard stats, member table with filters + CSV, member drawer (record, actions, notes, check-ins, activity log), queues (roster, REACH flags, hours, fundraising), chapters CRUD, roles, announcements, Esther Light scheduler |
| `js/core.js` | Shared client, auth (magic link with real error handling), roles, letter + certificate templates, CSV |
| `myeff.css` | Styles for member home and admin |
| `sql/2026-09-20_myeff2.sql` | Migration: chapters, roles, extended profiles, review fields, notes, activity log, passport stamps, check-ins, announcements, Esther Light, directory view, admin stats, RLS |
| `member-portal.html`, `staff.html` | Redirects to the new pages (keep old links working) |

## Deploy (15 minutes)
1. **Database.** In the shared Supabase project, SQL editor: run `membership-hub.sql` and `membership-hub-course-staff-update.sql` if they were never run, then `sql/2026-09-20_myeff2.sql`. It is idempotent.
2. **First admin.** Find the founder's user id in Authentication → Users, then run
   `insert into public.eff_chapter_roles(user_id, role) values ('<id>', 'national_staff');`
   Every later admin is granted from the Chapters → Roles panel.
3. **Auth settings.** Authentication → URL Configuration: set Site URL to `https://my.estherfundsfoundation.org` and add `https://my.estherfundsfoundation.org/member.html` and `/admin.html` to Redirect URLs. Under Email templates, keep the magic link; consider raising the OTP expiry to 3600s.
4. **Files.** Deploy the repo as-is. `supabase-config.js` holds only the publishable key (public by design; RLS protects all data).
5. **Smoke test.** Sign in as a new email → onboarding → letter appears → complete a module → log hours. Sign in as admin → approve the hours → the member's passport shows "First service approved."

## Security model
- Every table has row-level security. Members read/write their own rows; staff (role `national_staff` in `eff_chapter_roles`) manage everything via `eff_membership_staff()`.
- Members can only create *pending* hours/fundraising and edit them while pending; status changes are staff-only.
- Emails are exposed to staff only through `eff_member_email()`; the directory view shows opted-in members and public-safe fields only.
- Every membership, service, fundraising, module, and profile change is written to `eff_activity` by trigger.

## Known follow-ups
- Email delivery of the acceptance letter (a Supabase Edge Function or the newsletter provider; the letter HTML is in `core.js`).
- Join It API verification (today: staff verifies by hand from the queue).
- Chapter-level admin (advisors seeing only their chapter) — the roles table already supports it; add a policy set when needed.
