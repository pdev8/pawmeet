---
name: seed-demo
description: Populate (or wipe) the linked Supabase project with demo data — ~15 users with pets, events across Orange County cities, RSVPs, threaded comments, and community place reviews on real OSM parks/beaches/trails. Use when Paul wants to see a populated app (Discover feed, attendee strips, map reviews) or asks to reset/clear the demo data. Discover/map only show real Supabase rows now, so an empty backend looks empty.
---

# Seed demo — populate or wipe the Supabase demo data

Discover reads Supabase (`nearby_events`) and the map's place reviews come from
`place_reviews`, so a fresh project shows nothing. These scripts create a
believable Orange County demo so every surface looks alive. Pure data — no code
changes. All backed by the repo scripts in `scripts/`.

## Prereqs
- `.env` has `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (already gitignored).
- Node 18+ (global `fetch`). Run scripts with the env sourced:
  ```
  set -a; . ./.env; set +a
  ```

## Seed it
```
set -a; . ./.env; set +a
node scripts/seed-oc.mjs           # ~15 users (+pets), 14 events, ~100 RSVPs, ~15 comments
node scripts/seed-reviews-oc.mjs   # ~50 community reviews on real OC dog parks / beaches / trails
```
- Users are `seed-oc-1@pawk.dev` … `-15`, password `SeedPawk2026!` (sign in as one to see host/attendee flows).
- Events cluster within ~15 mi of central OC (Santa Ana/Irvine) so a phone with OC GPS sees them; otherwise Discover → tap the area → search "Santa Ana, CA" (or bump the radius filter).
- Reviews key to OSM ids (`way-<id>`) pulled via the app's exact Overpass query, clustered around **Huntington Beach / Irvine / Newport Beach** — open the **map** and center on one of those cities to see them (map fetches OSM within ~2 mi of center).
- Both scripts are re-run-safe: existing seed users are signed in (not duplicated) and already-reviewed places are skipped. (Re-running `seed-oc.mjs` will still create duplicate *events* — wipe first for a clean reseed.)

## Verify it landed
```
# events in radius of central OC:
curl -s "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/nearby_events" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <any-user-token>" -H "Content-Type: application/json" \
  -d '{"p_lat":33.7455,"p_lng":-117.8677,"p_radius_m":24140}'
```

## Wipe it
```
set -a; . ./.env; set +a
node scripts/wipe-seed.mjs         # deletes the 15 seed users; cascades their events/RSVPs/comments/pets/reviews
```
`delete_current_user` cascades via ON DELETE CASCADE, so this removes everything
the seed created in one pass. Idempotent.

## Notes
- To recenter the demo on a different metro, edit the `CITIES` / `CLUSTERS`
  arrays (lat/lng) at the top of the two seed scripts.
- These are real auth accounts in the linked project — fine for dev; don't seed a
  production project. Rotate/remove before any real launch.
