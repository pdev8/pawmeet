-- ---------------------------------------------------------------------------
-- Moderation: an admins allowlist, report lifecycle status, and admin-only RLS
-- so the console can read + resolve the moderation queue. Admin membership is
-- granted out-of-band (insert into public.admins from the SQL Editor); there is
-- deliberately no client-writable policy on the admins table.
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- A signed-in user may check their own membership (drives the console's gating);
-- nobody can grant/revoke admin from a client.
create policy "admins_select_self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- SECURITY DEFINER so RLS policies can call it without recursing into admins'
-- own policies. STABLE + fixed search_path.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = uid);
$$;
grant execute on function public.is_admin(uuid) to authenticated;

-- Report lifecycle.
create type public.report_status as enum ('open', 'resolved', 'dismissed');
alter table public.reports
  add column status      public.report_status not null default 'open',
  add column resolved_at timestamptz,
  add column resolved_by uuid references public.profiles (id) on delete set null;

-- Admins read the whole queue and resolve/dismiss; the insert-own policy from
-- the RLS migration still lets any user file a report.
create policy "reports_select_admin" on public.reports
  for select to authenticated using (public.is_admin(auth.uid()));
create policy "reports_update_admin" on public.reports
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Grant your first admin (run once in the SQL Editor):
--   insert into public.admins (user_id) values ('<your-auth-user-uuid>');
