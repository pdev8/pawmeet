-- In-app account deletion (Apple requires it for any app with sign-up).
--
-- A SECURITY DEFINER function lets a signed-in user delete *their own*
-- auth.users row. Deleting it cascades through profiles (which references
-- auth.users ON DELETE CASCADE) and from there to every child table
-- (pets, events, rsvps, comments, place_reviews, favorites, saved_searches,
-- reports, notifications) — so the user's data is fully removed in one call.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Only a signed-in user may call it (and it only ever deletes auth.uid()).
revoke execute on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;
