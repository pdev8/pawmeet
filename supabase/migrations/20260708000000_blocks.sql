-- ---------------------------------------------------------------------------
-- User blocking. A row (blocker, blocked) means blocker chose to hide blocked.
-- The app treats blocks as mutual for hiding purposes: it reads rows in either
-- direction (blocker OR blocked = me) and hides that other user's events,
-- RSVPs, and comments on both sides.
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

-- You can see blocks you're part of in either direction (so the client can
-- compute the mutual hide set), but you may only create/remove your own.
create policy "blocks_select_involved" on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());
create policy "blocks_insert_own" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "blocks_delete_own" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

create index blocks_blocked_idx on public.blocks (blocked_id);
