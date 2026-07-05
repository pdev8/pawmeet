-- Functions & triggers: profile bootstrap on signup, updated_at touch,
-- PostGIS radius search, and the archive/advance sweep.

-- ---------------------------------------------------------------------------
-- Create a profile row automatically when a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1),
      'New user'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep place_reviews.updated_at fresh on edit.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger place_reviews_touch_updated_at
  before update on public.place_reviews
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Radius search (PostGIS). Returns active, public, future events within
-- p_radius_m metres of (p_lat, p_lng), soonest first. Exposed as an RPC.
-- ---------------------------------------------------------------------------
create or replace function public.nearby_events(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision
)
returns setof public.events
language sql
stable
as $$
  select e.*
  from public.events e
  where e.status = 'active'
    and e.visibility = 'public'
    and e.starts_at >= now()
    and ST_DWithin(
      e.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  order by e.starts_at;
$$;

grant execute on function public.nearby_events(double precision, double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Archive/advance sweep. Non-recurring events archive ~24h after they end;
-- recurring events roll forward to their next future occurrence instead
-- (mirrors the mock store's archiveSweep). Cancelled past events archive too.
-- Run hourly via pg_cron (see below) or the API's scheduled job.
-- ---------------------------------------------------------------------------
create or replace function public.archive_past_events()
returns void
language plpgsql
as $$
declare
  r    record;
  step interval;
  dur  interval;
  ns   timestamptz;
begin
  for r in
    select * from public.events
    where status = 'active' and ends_at < now() - interval '24 hours'
  loop
    if r.recurrence is null then
      update public.events set status = 'archived', archived_at = now() where id = r.id;
    else
      step := case r.recurrence
                when 'weekly'   then interval '7 days'
                when 'biweekly' then interval '14 days'
                when 'monthly'  then interval '1 month'
              end;
      dur := r.ends_at - r.starts_at;
      ns := r.starts_at;
      while ns <= now() loop
        ns := ns + step;
      end loop;
      update public.events set starts_at = ns, ends_at = ns + dur where id = r.id;
    end if;
  end loop;

  update public.events set status = 'archived', archived_at = now()
  where status = 'cancelled' and ends_at < now() - interval '24 hours';
end;
$$;

-- The sweep is not client-callable.
revoke execute on function public.archive_past_events() from public, anon, authenticated;

-- Schedule hourly with pg_cron. Enable the extension in the Supabase dashboard
-- (Database → Extensions → pg_cron), then run this once:
--
--   select cron.schedule('archive-past-events', '0 * * * *',
--     $$ select public.archive_past_events(); $$);
