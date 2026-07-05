# Supabase backend (Epic 1)

The database that will replace the on-device mock store (`src/lib/store.ts`).
This directory holds the schema as ordered SQL migrations; the GitHub
integration applies them to the linked Supabase project.

## Layout

```
supabase/
  config.toml                         # CLI / project config
  migrations/
    20260704000000_initial_schema.sql       # extensions, enums, tables, indexes
    20260704000001_row_level_security.sql   # RLS enable + policies + grants
    20260704000002_functions_and_triggers.sql  # signup→profile, radius search, archive sweep
```

## How it gets applied

- **GitHub integration:** opening this PR creates a Supabase *preview branch* with
  these migrations applied to a throwaway database — use it to validate the SQL.
  Merging to the production branch applies them to prod.
- **CLI (optional):** the `supabase` CLI is a dev dependency.
  `npx supabase link --project-ref <ref>` then `npx supabase db push`, or
  `npx supabase start` for a local Postgres (needs Docker).

## What's modelled

Core (SPEC §4): `profiles` (1:1 with `auth.users`), `pets`, `events`, `rsvps`,
`comments`, `reports`. Plus the features the app already ships: `place_reviews`,
`favorites`, `saved_searches`, `notifications`.

- **PostGIS** `geography(Point,4326)` on `events.location` + a GIST index;
  `nearby_events(lat, lng, radius_m)` RPC does the radius search (`ST_DWithin`).
- **RLS is on for every table.** Sign-in is required; reads are for
  `authenticated`, writes are constrained to the owner, and event hosts may
  moderate RSVPs/comments on their own events. Reports have no client read
  policy (moderation queue = service role, Epic 11).
- **Triggers:** a new `auth.users` row auto-creates a `profiles` row;
  `place_reviews.updated_at` is touched on edit.
- **Archive sweep:** `archive_past_events()` archives events ~24h after they end,
  and rolls *recurring* events forward to their next occurrence instead. Schedule
  hourly with pg_cron (see the note at the bottom of the functions migration).

## Not done here (follow-ups)

- **Auth wiring in the app** — email/password + magic link work in Expo Go via
  `@supabase/supabase-js`; Sign in with Apple needs a custom dev build (native
  module), so it's deferred.
- **Client data layer** — swapping the zustand mock store for Supabase queries
  (TanStack Query) is the next layer, feature by feature.
- **Backyard address privacy** — the exact address should be masked for
  non-approved viewers via a view or column policy; currently the column is
  readable and the app masks it. Harden before launch.
- **Seed data** — a `supabase/seed.sql` mirroring `src/lib/seed.ts` for local dev.
