-- Pawk initial schema (Epic 1 — database foundation).
-- Backs the current app (profiles, pets, events, rsvps, comments, place
-- reviews, favorites, saved searches, reports, notifications) per SPEC §4.
-- Row-level security + functions live in the following migrations.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;   -- geography / ST_DWithin
create extension if not exists pgcrypto with schema extensions;  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.pet_size as enum ('S', 'M', 'L');
create type public.venue_type as enum ('home_backyard', 'public_park', 'dog_park', 'business', 'other');
create type public.rsvp_mode as enum ('open', 'host_approves');
create type public.event_status as enum ('active', 'cancelled', 'archived');
create type public.event_visibility as enum ('public', 'link_only');
create type public.event_recurrence as enum ('weekly', 'biweekly', 'monthly');
create type public.rsvp_status as enum (
  'going', 'interested', 'pending_approval', 'waitlisted', 'declined_by_host', 'cancelled'
);
create type public.report_target as enum ('event', 'user', 'comment');
create type public.comment_deleted_by as enum ('author', 'host');
create type public.notification_type as enum (
  'request_received', 'rsvp_approved', 'request_declined',
  'comment', 'reply', 'waitlist_promoted', 'event_cancelled'
);

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users. Exact home location is never stored, only a
-- coarse point + a user-chosen area label.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'New user',
  avatar_url   text,
  home_area    text,
  home_geo     geography(Point, 4326),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pets
-- ---------------------------------------------------------------------------
create table public.pets (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  name             text not null,
  species          text not null default 'dog',
  breed            text not null,
  photo_url        text,
  size             public.pet_size not null default 'M',
  temperament_tags text[] not null default '{}',
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events — location is a PostGIS point for radius search. For home_backyard
-- events the exact address is only revealed to the host + approved attendees
-- (enforced in the read path / a future masked view, not in this table).
-- ---------------------------------------------------------------------------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references public.profiles (id) on delete cascade,
  title           text not null,
  description     text not null default '',
  cover_photo_url text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  venue_type      public.venue_type not null,
  location        geography(Point, 4326) not null,
  address         text not null,
  area_label      text not null,
  breed_focus     text,
  capacity        int check (capacity is null or capacity > 0),
  rsvp_mode       public.rsvp_mode not null default 'open',
  recurrence      public.event_recurrence,
  status          public.event_status not null default 'active',
  visibility      public.event_visibility not null default 'public',
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint events_time_order check (ends_at >= starts_at)
);

-- ---------------------------------------------------------------------------
-- rsvps — one per (event, user). pet_ids lists which of your pets you bring.
-- ---------------------------------------------------------------------------
create table public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  pet_ids    uuid[] not null default '{}',
  status     public.rsvp_status not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- comments — one level of replies (parent_id), soft-deleted via deleted_by.
-- ---------------------------------------------------------------------------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  parent_id  uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_by public.comment_deleted_by
);

-- ---------------------------------------------------------------------------
-- place_reviews — reviews for map POIs. place_id is an external OSM id.
-- ---------------------------------------------------------------------------
create table public.place_reviews (
  id         uuid primary key default gen_random_uuid(),
  place_id   text not null,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- favorites — event bookmarks.
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ---------------------------------------------------------------------------
-- saved_searches — a snapshot of discovery filters + the area they applied to.
-- ---------------------------------------------------------------------------
create table public.saved_searches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  label        text not null,
  filters      jsonb not null,
  center       geography(Point, 4326),
  center_label text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reports — moderation. target_id points at an event/user/comment.
-- ---------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications — in-app inbox.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         public.notification_type not null,
  event_id     uuid references public.events (id) on delete cascade,
  from_user_id uuid references public.profiles (id) on delete set null,
  message      text not null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index events_location_gix on public.events using gist (location);
create index events_starts_at_idx on public.events (starts_at);
create index events_active_idx on public.events (starts_at) where status = 'active';
create index events_host_idx on public.events (host_id);
create index events_breed_idx on public.events (breed_focus);
create index rsvps_event_idx on public.rsvps (event_id);
create index rsvps_user_idx on public.rsvps (user_id);
create index comments_event_idx on public.comments (event_id);
create index comments_parent_idx on public.comments (parent_id);
create index place_reviews_place_idx on public.place_reviews (place_id);
create index place_reviews_author_idx on public.place_reviews (author_id);
create index pets_owner_idx on public.pets (owner_id);
create index favorites_user_idx on public.favorites (user_id);
create index saved_searches_user_idx on public.saved_searches (user_id);
create index notifications_user_idx on public.notifications (user_id, read);
