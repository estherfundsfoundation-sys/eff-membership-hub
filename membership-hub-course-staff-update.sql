alter table public.eff_member_profiles
  add column if not exists member_path text not null default 'member'
  check(member_path in ('member','alumni','community'));

create table if not exists public.eff_member_course_work(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  reflection text not null,
  quiz_answer text not null,
  passed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,module_key)
);

alter table public.eff_member_course_work enable row level security;

drop policy if exists "member owns course work" on public.eff_member_course_work;
create policy "member owns course work" on public.eff_member_course_work
  for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "national staff manages course work" on public.eff_member_course_work;
create policy "national staff manages course work" on public.eff_member_course_work
  for all to authenticated using(public.eff_membership_staff()) with check(public.eff_membership_staff());
