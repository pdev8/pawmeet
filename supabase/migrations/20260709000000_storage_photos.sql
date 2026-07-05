-- ---------------------------------------------------------------------------
-- Public "photos" storage bucket for user-uploaded images (pet photos first;
-- event covers + review photos later). Objects are namespaced by uploader:
-- `<auth-uid>/<kind>/<file>`, so RLS ties write access to that first folder.
-- Public read (public bucket) serves stable getPublicUrl links.
--
-- If `supabase db push` can't create storage policies (owned by
-- supabase_storage_admin), run this file's body in the SQL Editor instead.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public); only signed-in users can write, and only
-- inside their own `<uid>/...` prefix / to objects they own.
create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'photos');

create policy "photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

create policy "photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());
