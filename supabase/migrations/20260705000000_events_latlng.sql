-- Give events plain lat/lng columns so the client works with simple coordinates
-- instead of PostGIS-over-REST. A trigger keeps the geography `location` (used
-- by nearby_events / the GIST index) in sync from lat/lng.

alter table public.events
  add column lat double precision,
  add column lng double precision;

-- The table is empty in every environment so far, so require coordinates going forward.
alter table public.events alter column lat set not null;
alter table public.events alter column lng set not null;

create or replace function public.events_set_location()
returns trigger
language plpgsql
as $$
begin
  new.location := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  return new;
end;
$$;

-- Fires on insert (always) and when lat/lng change on update; sets location
-- before NOT NULL is checked, so clients only ever send lat/lng.
create trigger events_location_sync
  before insert or update of lat, lng on public.events
  for each row execute function public.events_set_location();
