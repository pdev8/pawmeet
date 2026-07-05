-- Row-level security for all public tables.
-- The app requires sign-in, so read policies target the `authenticated` role.
-- Writes are constrained to the owning user (auth.uid()), with hosts allowed
-- to moderate RSVPs/comments on their own events.

-- Table privileges (RLS still governs row visibility on top of these).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.profiles       enable row level security;
alter table public.pets           enable row level security;
alter table public.events         enable row level security;
alter table public.rsvps          enable row level security;
alter table public.comments       enable row level security;
alter table public.place_reviews  enable row level security;
alter table public.favorites      enable row level security;
alter table public.saved_searches enable row level security;
alter table public.reports        enable row level security;
alter table public.notifications  enable row level security;

-- ---- profiles ----
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---- pets ---- (readable by all so attendee badges can show pets)
create policy "pets_select" on public.pets
  for select to authenticated using (true);
create policy "pets_insert_own" on public.pets
  for insert to authenticated with check (owner_id = auth.uid());
create policy "pets_update_own" on public.pets
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "pets_delete_own" on public.pets
  for delete to authenticated using (owner_id = auth.uid());

-- ---- events ---- (host manages; discovery filters visibility in queries)
create policy "events_select" on public.events
  for select to authenticated using (true);
create policy "events_insert_host" on public.events
  for insert to authenticated with check (host_id = auth.uid());
create policy "events_update_host" on public.events
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "events_delete_host" on public.events
  for delete to authenticated using (host_id = auth.uid());

-- ---- rsvps ---- (visible to all for attendee lists; you manage yours, the
-- event host may update them to approve/decline/promote)
create policy "rsvps_select" on public.rsvps
  for select to authenticated using (true);
create policy "rsvps_insert_own" on public.rsvps
  for insert to authenticated with check (user_id = auth.uid());
create policy "rsvps_update_own_or_host" on public.rsvps
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );
create policy "rsvps_delete_own" on public.rsvps
  for delete to authenticated using (user_id = auth.uid());

-- ---- comments ---- (author edits; author or host soft-deletes)
create policy "comments_select" on public.comments
  for select to authenticated using (true);
create policy "comments_insert_own" on public.comments
  for insert to authenticated with check (author_id = auth.uid());
create policy "comments_update_author_or_host" on public.comments
  for update to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );

-- ---- place_reviews ----
create policy "place_reviews_select" on public.place_reviews
  for select to authenticated using (true);
create policy "place_reviews_insert_own" on public.place_reviews
  for insert to authenticated with check (author_id = auth.uid());
create policy "place_reviews_update_own" on public.place_reviews
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "place_reviews_delete_own" on public.place_reviews
  for delete to authenticated using (author_id = auth.uid());

-- ---- favorites ---- (private to the user)
create policy "favorites_select_own" on public.favorites
  for select to authenticated using (user_id = auth.uid());
create policy "favorites_insert_own" on public.favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy "favorites_delete_own" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

-- ---- saved_searches ---- (private to the user)
create policy "saved_searches_select_own" on public.saved_searches
  for select to authenticated using (user_id = auth.uid());
create policy "saved_searches_insert_own" on public.saved_searches
  for insert to authenticated with check (user_id = auth.uid());
create policy "saved_searches_update_own" on public.saved_searches
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_searches_delete_own" on public.saved_searches
  for delete to authenticated using (user_id = auth.uid());

-- ---- reports ---- (users file reports; only moderators/service role read them)
create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());
-- No select policy on purpose: regular clients cannot read the moderation queue
-- (the service role bypasses RLS for an admin view — Epic 11).

-- ---- notifications ---- (recipients read + mark read; a user's actions can
-- create a notification addressed to someone else, e.g. commenting notifies the
-- host. A real backend would move creation into security-definer triggers.)
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_insert_from_self" on public.notifications
  for insert to authenticated with check (from_user_id = auth.uid() or from_user_id is null);
