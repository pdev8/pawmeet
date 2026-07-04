# Pawk — v1 demo build

Find, post, RSVP to, and comment on pet events near you — plus a dog-friendly
places map with community reviews. This build implements the M0–M2 scope of
[SPEC.md](SPEC.md) (and most of the M3 map) on a **local mock data layer** (no
backend): all events, people, comments, reviews, and notifications are seeded or
stored on-device, so every flow is testable immediately. See
[BACKLOG.md](BACKLOG.md) for what's built and the roadmap to launch.

## Run it on your iPhone (from Windows or Mac)

1. Install **Expo Go** from the App Store on your iPhone.
2. On this machine:
   ```
   cd pawmeet
   npx expo start
   ```
3. Scan the QR code with the iPhone camera (phone and computer must be on the
   same Wi-Fi). If your network blocks device-to-device traffic, use
   `npx expo start --tunnel` instead.

On first launch the app asks for location and re-centers the demo events around
you, so distances are real. If you decline, events center on the demo city
(Austin, TX) — changeable from the Discover header.

## What to try

- **Discover:** filter by radius / dates / breed / venue, switch sorts, tap
  "Golden Retriever" in filters (breed filter shows breed events *plus* all-breeds events).
- **RSVP:** an open event (instant), a full event (waitlist — try *Agility Basics 101*),
  and a backyard event (request → mock host approves after ~6s and the exact
  address unlocks; watch the Inbox).
- **Comments:** ask a question on someone's event — the mock host replies in a
  few seconds. You can edit/delete your own comments; on your event you can
  remove anyone's.
- **Hosting:** *Buddy's Backyard Hang* is yours and has 2 pending join requests
  in the Inbox to approve/decline. Post a new event from the **Post** tab.
- **Archive:** the **Past** section on Profile has archived events — comments
  locked, backyard address scrubbed, and a one-tap **Host it again**.
- **Map:** open the dog-friendly map (from Discover) — real OpenStreetMap parks,
  dog parks, beaches, and trails as color-coded crosshatched areas. Toggle the
  category filters (they scroll on one row), tap an area for hours + community
  reviews, and **leave your own review** (rate, edit, delete — right in the sheet).
- **Reset demo data** is at the bottom of Profile.

## Known demo limitations (deliberate)

- No backend/auth — single local "you" profile, data (incl. your reviews)
  persists on-device only.
- New events pin near your area center; the map's search box does geocode real
  places (Nominatim) and areas come from live OpenStreetMap (Overpass).
- Mock host approval/replies are simulated timers.
- Saved-search alerts are still spec M3 (not in this build).
- Liquid Glass renders natively on iOS 26+; older iOS gets blur fallbacks.
- Cover/pet photos come from placedog.net / pravatar.cc (needs internet).
