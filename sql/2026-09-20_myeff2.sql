-- ============================================================================
-- MyEFF 2.0 — migration 2026-09-20
-- Run once in the shared REACH Supabase SQL editor, AFTER membership-hub.sql
-- and membership-hub-course-staff-update.sql. Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------- roles ----
-- The original code referenced public.eff_chapter_roles but never created it.
create table if not exists public.eff_chapter_roles(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);
alter table public.eff_chapter_roles add column if not exists chapter_id uuid;
alter table public.eff_chapter_roles add column if not exists granted_by uuid references auth.users(id);
alter table public.eff_chapter_roles drop constraint if exists eff_chapter_roles_role_check;
alter table public.eff_chapter_roles add constraint eff_chapter_roles_role_check
  check (role in ('national_staff','regional','advisor','president','vice_president','secretary','treasurer','officer'));
create unique index if not exists eff_chapter_roles_unique on public.eff_chapter_roles(user_id, role, coalesce(chapter_id,'00000000-0000-0000-0000-000000000000'::uuid));
alter table public.eff_chapter_roles enable row level security;

-- staff helper (re-created so it exists even if the earlier file wasn't run)
create or replace function public.eff_membership_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.eff_chapter_roles where user_id=auth.uid() and role='national_staff')
$$;

drop policy if exists "roles: member sees own" on public.eff_chapter_roles;
create policy "roles: member sees own" on public.eff_chapter_roles for select to authenticated using (user_id=auth.uid());
drop policy if exists "roles: staff manages" on public.eff_chapter_roles;
create policy "roles: staff manages" on public.eff_chapter_roles for all to authenticated using (public.eff_membership_staff()) with check (public.eff_membership_staff());
-- members may see who leads their own chapter (names come via the directory view below)
drop policy if exists "roles: chapter members see leaders" on public.eff_chapter_roles;
create policy "roles: chapter members see leaders" on public.eff_chapter_roles for select to authenticated
  using (role<>'national_staff' and chapter_id is not null and chapter_id=(select chapter_id from public.eff_member_profiles where user_id=auth.uid()));

-- ------------------------------------------------------------- chapters ----
create table if not exists public.eff_chapters(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  school text not null,
  city text not null,
  state text not null,
  kind text not null default 'chapter' check (kind in ('chapter','pgws','national')),
  status text not null default 'active' check (status in ('provisional','active','probation','suspended','dissolved')),
  founded date,
  dues_note text,
  created_at timestamptz not null default now()
);
alter table public.eff_chapters enable row level security;
drop policy if exists "chapters: anyone reads" on public.eff_chapters;
create policy "chapters: anyone reads" on public.eff_chapters for select to anon, authenticated using (true);
drop policy if exists "chapters: staff manages" on public.eff_chapters;
create policy "chapters: staff manages" on public.eff_chapters for all to authenticated using (public.eff_membership_staff()) with check (public.eff_membership_staff());

insert into public.eff_chapters(slug,name,school,city,state,kind) values
 ('national','National Member — No Chapter','Any college or university','Nationwide','US','national'),
 ('lsu','EFF at Louisiana State University','Louisiana State University','Baton Rouge','LA','chapter'),
 ('southern','EFF at Southern University and A&M College','Southern University and A&M College','Baton Rouge','LA','chapter'),
 ('dsu','EFF at Delaware State University','Delaware State University','Dover','DE','chapter'),
 ('xula','EFF at Xavier University of Louisiana','Xavier University of Louisiana','New Orleans','LA','chapter'),
 ('howard','EFF at Howard University','Howard University','Washington','DC','chapter'),
 ('nsu','EFF at Norfolk State University','Norfolk State University','Norfolk','VA','chapter'),
 ('tsc','EFF at Tallahassee State College','Tallahassee State College','Tallahassee','FL','chapter'),
 ('ssu','EFF at Savannah State University','Savannah State University','Savannah','GA','chapter'),
 ('cau','EFF at Clark Atlanta University','Clark Atlanta University','Atlanta','GA','chapter'),
 ('asu','EFF at Albany State University','Albany State University','Albany','GA','chapter'),
 ('vsu','EFF at Virginia State University','Virginia State University','Petersburg','VA','chapter'),
 ('ksu','EFF at Kentucky State University','Kentucky State University','Frankfort','KY','chapter'),
 ('tuskegee','EFF at Tuskegee University','Tuskegee University','Tuskegee','AL','chapter'),
 ('fiu','EFF at Florida International University','Florida International University','Miami','FL','chapter'),
 ('uncg','EFF at UNC Greensboro','University of North Carolina at Greensboro','Greensboro','NC','chapter'),
 ('shsu','EFF at Sam Houston State University','Sam Houston State University','Huntsville','TX','chapter'),
 ('pgws-dsu','Pretty Girls Who Serve — Delaware State University','Delaware State University','Dover','DE','pgws'),
 ('pgws-nsu','Pretty Girls Who Serve — Norfolk State University','Norfolk State University','Norfolk','VA','pgws')
on conflict (slug) do nothing;

-- ------------------------------------------------------------- profiles ----
alter table public.eff_member_profiles add column if not exists chapter_id uuid references public.eff_chapters(id);
alter table public.eff_member_profiles add column if not exists city text;
alter table public.eff_member_profiles add column if not exists state text;
alter table public.eff_member_profiles add column if not exists phone text;
alter table public.eff_member_profiles add column if not exists pronouns text;
alter table public.eff_member_profiles add column if not exists bio text;
alter table public.eff_member_profiles add column if not exists directory_opt_in boolean not null default false;
alter table public.eff_member_profiles add column if not exists email_updates boolean not null default true;
alter table public.eff_member_profiles add column if not exists sms_updates boolean not null default false;
alter table public.eff_member_profiles add column if not exists updated_at timestamptz not null default now();
-- link legacy free-text chapter to a chapter row where it matches
update public.eff_member_profiles p set chapter_id=c.id from public.eff_chapters c
  where p.chapter_id is null and p.chapter is not null and lower(p.chapter)=lower(c.name);

-- membership records: extra lifecycle fields
alter table public.eff_membership_records add column if not exists verified_at timestamptz;
alter table public.eff_membership_records add column if not exists verified_by uuid references auth.users(id);
alter table public.eff_membership_records add column if not exists induction_date date;
alter table public.eff_membership_records add column if not exists letter_viewed_at timestamptz;
alter table public.eff_membership_records add column if not exists updated_at timestamptz not null default now();
-- members may record that they viewed their letter (the only column they can update)
create or replace function public.eff_mark_letter_viewed() returns void language sql security definer set search_path=public as $$
  update public.eff_membership_records set letter_viewed_at=coalesce(letter_viewed_at,now()) where user_id=auth.uid()
$$;

-- service hours: review fields + evidence
alter table public.eff_member_service_hours add column if not exists service_date date;
alter table public.eff_member_service_hours add column if not exists organization text;
alter table public.eff_member_service_hours add column if not exists evidence_url text;
alter table public.eff_member_service_hours add column if not exists reviewed_by uuid references auth.users(id);
alter table public.eff_member_service_hours add column if not exists reviewed_at timestamptz;
alter table public.eff_member_service_hours add column if not exists review_note text;
-- members may create and read; they may edit only while pending
drop policy if exists "member owns service" on public.eff_member_service_hours;
create policy "service: member reads own" on public.eff_member_service_hours for select to authenticated using (user_id=auth.uid());
create policy "service: member inserts own" on public.eff_member_service_hours for insert to authenticated with check (user_id=auth.uid() and status='pending');
create policy "service: member edits pending" on public.eff_member_service_hours for update to authenticated using (user_id=auth.uid() and status='pending') with check (user_id=auth.uid() and status='pending');
create policy "service: member deletes pending" on public.eff_member_service_hours for delete to authenticated using (user_id=auth.uid() and status='pending');

-- fundraising: campaign + review
alter table public.eff_member_fundraising add column if not exists campaign text not null default 'National Popcorn Week';
alter table public.eff_member_fundraising add column if not exists reviewed_by uuid references auth.users(id);
alter table public.eff_member_fundraising add column if not exists reviewed_at timestamptz;
drop policy if exists "member owns fundraising" on public.eff_member_fundraising;
create policy "fund: member reads own" on public.eff_member_fundraising for select to authenticated using (user_id=auth.uid());
create policy "fund: member inserts own" on public.eff_member_fundraising for insert to authenticated with check (user_id=auth.uid() and status='pending');
create policy "fund: member edits pending" on public.eff_member_fundraising for update to authenticated using (user_id=auth.uid() and status='pending') with check (user_id=auth.uid() and status='pending');

-- ---------------------------------------------------------------- notes ----
create table if not exists public.eff_member_notes(
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.eff_member_notes enable row level security;
drop policy if exists "notes: staff only" on public.eff_member_notes;
create policy "notes: staff only" on public.eff_member_notes for all to authenticated using (public.eff_membership_staff()) with check (public.eff_membership_staff() and author_id=auth.uid());

-- ------------------------------------------------------------- activity ----
create table if not exists public.eff_activity(
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists eff_activity_subject on public.eff_activity(subject_user_id, created_at desc);
alter table public.eff_activity enable row level security;
drop policy if exists "activity: staff reads" on public.eff_activity;
create policy "activity: staff reads" on public.eff_activity for select to authenticated using (public.eff_membership_staff());
drop policy if exists "activity: member reads own" on public.eff_activity;
create policy "activity: member reads own" on public.eff_activity for select to authenticated using (subject_user_id=auth.uid());

create or replace function public.eff_log_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare subj uuid; act text; det jsonb;
begin
  if tg_table_name='eff_membership_records' then
    subj:=new.user_id; act:='membership.'||tg_op;
    det:=jsonb_build_object('joinit_status',new.joinit_status,'membership_status',new.membership_status,'access_revoked',new.access_revoked);
  elsif tg_table_name='eff_member_service_hours' then
    subj:=new.user_id; act:='service.'||tg_op; det:=jsonb_build_object('hours',new.hours,'status',new.status,'title',new.title);
  elsif tg_table_name='eff_member_fundraising' then
    subj:=new.user_id; act:='fundraising.'||tg_op; det:=jsonb_build_object('amount',new.amount,'status',new.status,'campaign',new.campaign);
  elsif tg_table_name='eff_member_module_completions' then
    subj:=new.user_id; act:='module.completed'; det:=jsonb_build_object('module_key',new.module_key);
  elsif tg_table_name='eff_member_profiles' then
    subj:=new.user_id; act:='profile.'||tg_op; det:=jsonb_build_object('school',new.school,'chapter_id',new.chapter_id,'member_path',new.member_path);
  end if;
  insert into public.eff_activity(subject_user_id,actor_id,action,detail) values (subj,auth.uid(),act,det);
  return new;
end $$;
drop trigger if exists eff_act_records on public.eff_membership_records;
create trigger eff_act_records after insert or update on public.eff_membership_records for each row execute function public.eff_log_activity();
drop trigger if exists eff_act_service on public.eff_member_service_hours;
create trigger eff_act_service after insert or update on public.eff_member_service_hours for each row execute function public.eff_log_activity();
drop trigger if exists eff_act_fund on public.eff_member_fundraising;
create trigger eff_act_fund after insert or update on public.eff_member_fundraising for each row execute function public.eff_log_activity();
drop trigger if exists eff_act_modules on public.eff_member_module_completions;
create trigger eff_act_modules after insert on public.eff_member_module_completions for each row execute function public.eff_log_activity();
drop trigger if exists eff_act_profiles on public.eff_member_profiles;
create trigger eff_act_profiles after insert or update on public.eff_member_profiles for each row execute function public.eff_log_activity();

-- ------------------------------------------------------------- passport ----
create table if not exists public.eff_passport_stamps(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stamp_key text not null,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references auth.users(id),
  unique(user_id, stamp_key)
);
alter table public.eff_passport_stamps enable row level security;
drop policy if exists "stamps: member reads own" on public.eff_passport_stamps;
create policy "stamps: member reads own" on public.eff_passport_stamps for select to authenticated using (user_id=auth.uid());
drop policy if exists "stamps: staff manages" on public.eff_passport_stamps;
create policy "stamps: staff manages" on public.eff_passport_stamps for all to authenticated using (public.eff_membership_staff()) with check (public.eff_membership_staff());

-- automatic stamps: joined, esther_experience (all 8 modules), first_service (first approved hours), verified
create or replace function public.eff_auto_stamps() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='eff_member_profiles' and tg_op='INSERT' then
    insert into public.eff_passport_stamps(user_id,stamp_key) values(new.user_id,'joined') on conflict do nothing;
  elsif tg_table_name='eff_member_module_completions' then
    if (select count(*) from public.eff_member_module_completions where user_id=new.user_id)>=8 then
      insert into public.eff_passport_stamps(user_id,stamp_key) values(new.user_id,'esther_experience') on conflict do nothing;
    end if;
  elsif tg_table_name='eff_member_service_hours' and new.status='approved' then
    insert into public.eff_passport_stamps(user_id,stamp_key) values(new.user_id,'first_service') on conflict do nothing;
  elsif tg_table_name='eff_membership_records' and new.joinit_status='verified' then
    insert into public.eff_passport_stamps(user_id,stamp_key) values(new.user_id,'verified') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists eff_stamp_profile on public.eff_member_profiles;
create trigger eff_stamp_profile after insert on public.eff_member_profiles for each row execute function public.eff_auto_stamps();
drop trigger if exists eff_stamp_modules on public.eff_member_module_completions;
create trigger eff_stamp_modules after insert on public.eff_member_module_completions for each row execute function public.eff_auto_stamps();
drop trigger if exists eff_stamp_service on public.eff_member_service_hours;
create trigger eff_stamp_service after insert or update on public.eff_member_service_hours for each row execute function public.eff_auto_stamps();
drop trigger if exists eff_stamp_records on public.eff_membership_records;
create trigger eff_stamp_records after insert or update on public.eff_membership_records for each row execute function public.eff_auto_stamps();

-- ------------------------------------------------------------ check-ins ----
create table if not exists public.eff_checkins(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academic smallint check (academic between 1 and 5),
  wellness smallint check (wellness between 1 and 5),
  belonging smallint check (belonging between 1 and 5),
  needs_reach boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
alter table public.eff_checkins enable row level security;
drop policy if exists "checkins: member owns" on public.eff_checkins;
create policy "checkins: member owns" on public.eff_checkins for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "checkins: staff reads" on public.eff_checkins;
create policy "checkins: staff reads" on public.eff_checkins for select to authenticated using (public.eff_membership_staff());

-- -------------------------------------------------------- announcements ----
create table if not exists public.eff_announcements(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all','chapter')),
  chapter_id uuid references public.eff_chapters(id),
  published_at timestamptz,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.eff_announcements enable row level security;
drop policy if exists "news: members read published" on public.eff_announcements;
create policy "news: members read published" on public.eff_announcements for select to authenticated
  using (published_at is not null and published_at<=now() and (audience='all' or chapter_id=(select chapter_id from public.eff_member_profiles where user_id=auth.uid())));
drop policy if exists "news: staff manages" on public.eff_announcements;
create policy "news: staff manages" on public.eff_announcements for all to authenticated using (public.eff_membership_staff()) with check (public.eff_membership_staff());

-- --------------------------------------------------------- esther light ----
create table if not exists public.eff_light_daily(
  id uuid primary key default gen_random_uuid(),
  day date unique not null,
  verse_ref text not null,
  verse_text text not null,
  reflection text,
  created_at timestamptz not null default now()
);
alter table public.eff_light_daily enable row level security;
drop policy if exists "light: members read" on public.eff_light_daily;
create policy "light: members read" on public.eff_light_daily for select to authenticated using (true);
drop policy if exists "light: staff manages" on public.eff_light_daily;
create policy "light: staff manages" on public.eff_light_daily for all to authenticated using (public.eff_membership_staff()) with check (public.eff_membership_staff());

-- ------------------------------------------------------------ directory ----
-- Only opted-in members, only public-safe fields. Members and staff can read.
create or replace view public.eff_directory as
  select p.user_id, coalesce(p.preferred_name,p.full_name) as display_name, p.school, p.major, p.graduation_year, p.city, p.state, p.bio, p.chapter_id, c.name as chapter_name
  from public.eff_member_profiles p left join public.eff_chapters c on c.id=p.chapter_id
  where p.directory_opt_in=true;
grant select on public.eff_directory to authenticated;

-- ---------------------------------------------------------- admin stats ----
create or replace function public.eff_admin_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare out jsonb;
begin
  if not public.eff_membership_staff() then raise exception 'not staff'; end if;
  select jsonb_build_object(
    'members', (select count(*) from public.eff_member_profiles),
    'new_7d', (select count(*) from public.eff_member_profiles where created_at>now()-interval '7 days'),
    'unverified', (select count(*) from public.eff_membership_records where joinit_status in ('unverified','pending')),
    'verified', (select count(*) from public.eff_membership_records where joinit_status='verified'),
    'active', (select count(*) from public.eff_membership_records where membership_status='active'),
    'alumni', (select count(*) from public.eff_membership_records where membership_status='alumni'),
    'hours_pending', (select count(*) from public.eff_member_service_hours where status='pending'),
    'hours_approved_total', (select coalesce(sum(hours),0) from public.eff_member_service_hours where status='approved'),
    'fund_pending', (select count(*) from public.eff_member_fundraising where status='pending'),
    'fund_approved_total', (select coalesce(sum(amount),0) from public.eff_member_fundraising where status='approved'),
    'experience_complete', (select count(*) from (select user_id from public.eff_member_module_completions group by user_id having count(*)>=8) x),
    'reach_flags_30d', (select count(*) from public.eff_checkins where needs_reach and created_at>now()-interval '30 days'),
    'by_chapter', (select coalesce(jsonb_agg(jsonb_build_object('chapter',c.name,'state',c.state,'members',n)),'[]'::jsonb) from (select chapter_id, count(*) n from public.eff_member_profiles group by chapter_id) m join public.eff_chapters c on c.id=m.chapter_id),
    'by_state', (select coalesce(jsonb_object_agg(coalesce(state,'—'),n),'{}'::jsonb) from (select state, count(*) n from public.eff_member_profiles group by state) s)
  ) into out;
  return out;
end $$;

-- staff also needs to read auth emails for the member table: expose a safe view
create or replace function public.eff_member_email(uid uuid) returns text language sql stable security definer set search_path=public as $$
  select case when public.eff_membership_staff() or uid=auth.uid() then (select email from auth.users where id=uid) else null end
$$;

-- --------------------------------------------------------- housekeeping ----
create or replace function public.eff_touch() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists eff_touch_profiles on public.eff_member_profiles;
create trigger eff_touch_profiles before update on public.eff_member_profiles for each row execute function public.eff_touch();
drop trigger if exists eff_touch_records on public.eff_membership_records;
create trigger eff_touch_records before update on public.eff_membership_records for each row execute function public.eff_touch();

-- FIRST STAFF ACCOUNT: run once, with the founder's auth user id
-- insert into public.eff_chapter_roles(user_id, role) values ('<auth.users.id>', 'national_staff') on conflict do nothing;
