# Pawk — Backlog

Agile backlog for taking Pawk from the v1 mock-data demo toward launch. This is
the **source of truth for status**; the other docs cover different angles:

| Doc | Answers |
|---|---|
| [SPEC.md](SPEC.md) | product vision + data model (what/why) |
| **BACKLOG.md** (this) | what's built + what's next (status/roadmap) |
| [AGENTS.md](AGENTS.md) | how the code is structured (for coding agents) |
| [README.md](README.md) | how to run it + a demo tour |

## Current state (2026-07-04)

Built on a **local mock store** (zustand + AsyncStorage, no backend), so every
flow is testable on-device today:
- **Events:** discover (radius / date / breed / venue filters, sorts), post
  (5-step wizard), event detail, archive sweep + "Host it again".
- **Social:** RSVP with capacity → waitlist → promotion, host-approval flow,
  threaded comments with host moderation. Backend liveness is faked with timers.
- **Dog-friendly map:** live OpenStreetMap areas (dog parks / parks / reserves /
  beaches / trails), one color per category driving polygons + hatch + filter
  chips, place detail with hours, and **community reviews** (add / edit / delete
  your own, on-device only).
- **Tooling:** ESLint wired up (`npx expo lint`); web preview bundles.

Everything is against **mock data** — the real backend (Epic 1) is the keystone
that turns all of it real. Milestone mapping lives in [SPEC.md §9](SPEC.md).

**Legend:** 🟢 independent (grab anytime) · 🔴 blocks/unblocks others · ⭐ suggested next · 🚫 App Store submission blocker (Apple rejects without it)

---

## EPIC 1 — Backend & Auth  🔴 (unblocks most "real data" work)
- [x] Decide backend: Supabase (Postgres + PostGIS)
- [x] Stand up schema: profiles, pets, events, rsvps, comments, reports + place_reviews / favorites / saved_searches / notifications, with RLS (merged PR #5)
- [x] Email auth (Supabase email/password + login gate, PR #7) — works in Expo Go
- [ ] Sign in with Apple  🚫 — needs a custom dev build (deferred while pinned to Expo Go)
- [x] In-app account deletion flow — `delete_current_user` RPC + ON DELETE CASCADE (verified end-to-end); meets the Apple requirement
- [ ] Swap zustand mock store → real data layer (TanStack Query) — migrated: client (#6), Profile (#9), Pets (#10), Place reviews (#11), Events (#12), RSVP core (#13), Comments (#14), attendee badges + going counts (#15) — all verified e2e; next: host approve/decline UI
- [ ] Replace mock timers (host approval ~6s, canned replies ~7s) with real writes
- [~] PostGIS radius search — `nearby_events(lat,lng,radius)` RPC created; app still uses haversine until the client layer lands
- [~] Scheduled archival job — `archive_past_events()` created; enable pg_cron in the dashboard to schedule it hourly

## EPIC 2 — Map & Places  🟢
- [ ] Persist filter selections across sessions
- [ ] Cluster pins when zoomed out (many places overlap)
- [ ] Cache Overpass results so re-opening the map isn't a cold fetch
- [ ] Loading / empty / error states polish for "search this area"
- [ ] Show event pins on the map (tie Discover events → map), not just POIs
- [ ] Legend / key for the category colors

## EPIC 3 — Place Reviews (extend what's built)  🟢 ⭐
- [ ] Persist reviews to backend (currently on-device only)
- [ ] Real relative timestamps instead of "Just now"
- [ ] Show review count next to the star rating
- [ ] Attach a photo to a review
- [ ] Report / flag a review (ties into moderation epic)

## EPIC 4 — Discovery / Search  🟢 ⭐
- [x] "Has spots left" toggle — already in the filter sheet
- [x] Empty-state CTA: "host the first event in this area" — already wired
- [x] Real place geocoding for the area picker (Nominatim) — shipped: inline collapsible search + loading UX + location-varied demo events
- [ ] Saved searches ("goldens within 25 mi") — deferred to a future enhancement (built + tested on branch `epic4/saved-searches`, PR #3 closed); alerts need Epic 8
- [x] Favorite / bookmark events → a Saved list (heart on cards + event detail; collapsible Saved section on Profile)
- [ ] Map ⇄ list toggle on the Discover screen — deferred: needs device-in-loop (touches the pull-to-refresh animation)

## EPIC 5 — Post / Host an Event  🟢
- [ ] Address autocomplete (MapKit search) in the Where step
- [ ] Real cover-photo upload (currently placedog.net)
- [ ] Edit event (notify attendees of time/place changes)
- [ ] Host dashboard: attendee + pet list, headcount incl. dogs
- [x] Recurring events (weekly / biweekly / monthly) — recurrence option in the post wizard; auto-advances to the next occurrence instead of archiving

## EPIC 6 — RSVP & Attendance  🟢
- [ ] Choose which pet(s) you're bringing on RSVP
- [ ] Add-to-calendar from event detail
- [ ] New-account friction for hosting backyard events (attended 1 / verified phone)

## EPIC 7 — Comments  🟢
- [ ] Realtime new comments while the event screen is open
- [x] "Host" / "Going" author context chips — live on Supabase-backed comments (#14)
- [x] 1000-char cap enforcement — DB CHECK + client maxLength (#14); rate limit still TODO
- [ ] Report a comment

## EPIC 8 — Notifications & Push  🔴 (needs backend)
- [ ] Expo Notifications + APNs setup
- [ ] Event reminders (24h + 2h before)
- [ ] Push: RSVP approved, waitlist promoted, event changed / cancelled
- [ ] Comment notifications (batched per event)
- [ ] Saved-search match alerts

## EPIC 9 — Onboarding  🟢
- [ ] Sign-in → create owner profile → add pet(s) flow
- [ ] Location permission ask with value framing
- [ ] Optional: create a saved search from breed + area at the end

## EPIC 10 — Profiles & Badges  🟢
- [ ] Pet profile screen (photo, breed, size, temperament tags)
- [ ] Achievement badges: First Meetup, Host, 5 Events, Breed Ambassador
- [ ] Tap attendee badge → mini profile

## EPIC 11 — Trust, Safety & Moderation  🟢 (launch-critical for a UGC app)
- [ ] Report event / user / comment  🚫 (UGC apps need report or Apple rejects)
- [ ] Block user (mutual hide of events, RSVPs, comments)  🚫
- [ ] Simple admin moderation-queue web view + a process/owner for reviewing reports
- [ ] Age gate (17+) + community guidelines text on events  🚫

## EPIC 12 — Design System & Accessibility  🟢
- [ ] Respect Reduce Transparency (glass → solid) & Reduce Motion
- [ ] Dynamic Type audit; 44pt touch targets
- [ ] Accessible labels on avatar badges ("Sam and Biscuit, going")

## EPIC 13 — Infra / DevOps  🟢
- [ ] EAS Build (cloud) — dev client + TestFlight from Windows or Mac
- [ ] EAS Submit — automated App Store submission
- [ ] EAS Update — OTA update + rollback strategy
- [ ] Custom dev client (needed once past Expo Go SDK limits)
- [ ] .gitattributes (LF), .nvmrc / volta pin, cross-platform npm scripts
- [ ] CI: typecheck + lint + expo export on PRs

## EPIC 14 — Tech Debt / Quality  🟢
- [x] Add a test suite — Vitest unit tests for pure `src/lib` logic (`npm test`)
- [ ] Extend test coverage: filters/discovery, selectors (address privacy), dates, seed
- [ ] Component/interaction tests once a RN-aware runner is added (jest-expo or RNTL)
- [ ] Fix lint findings now that ESLint is wired up
- [ ] Web-preview parity pass (map.web stub, etc.)

## EPIC 15 — Release & Launch  🔴 (this is "ship & operate it", not "build it")

### 15a — App Store submission
- [ ] Apple Developer Program membership ($99/yr) + App Store Connect app record + bundle ID
- [ ] App icon, launch screen, screenshots for all device sizes, optional preview video
- [ ] Store metadata: description, keywords, category, support URL  🚫 (support URL required)
- [ ] Age-rating questionnaire + export-compliance (encryption) declaration
- [ ] App Privacy "nutrition labels" — declare data collected (location, photos, contacts)  🚫
- [ ] TestFlight beta round before public submission

### 15b — Legal / compliance
- [ ] Privacy Policy hosted at a public URL + linked in-app and in App Store  🚫
- [ ] Terms of Service / EULA + community guidelines
- [ ] GDPR/CCPA data export + deletion (pairs with in-app account deletion in Epic 1)

### 15c — Production ops & security
- [ ] Separate prod environment + secrets management
- [ ] Row-level security policies (Supabase RLS) — critical with location + UGC
- [ ] DB backups + migration strategy
- [ ] API-layer rate limiting / abuse protection
- [ ] Security review pass (UGC + location data)

### 15d — Observability
- [ ] Crash + error reporting (Sentry)
- [ ] Product analytics + KPIs
- [ ] Uptime / error alerting + logging

### 15e — Launch readiness (non-code)
- [ ] Cold-start content plan: seed launch events or pick a beachhead city
      (an empty events map/list is a dead app)
- [ ] Support channel (support email — also required by App Store)
- [ ] Versioning + release + rollback process

---

## Sequencing notes
- **Epic 1 (Backend)** is the keystone — Epic 8 (Push) and the "persist" tasks
  in Epics 2/3/4 depend on it. Everything tagged 🟢 can be built today against
  the mock store and re-pointed at the real backend later.
- Momentum picks that need no backend: **Epic 3** (extend reviews),
  **Epic 4** (map⇄list + saved searches), **Epic 13** (EAS → TestFlight build).
- **Epic 15 is the go-live track** — building the 14 feature epics is "build it";
  Epic 15 is "ship & operate it." Don't schedule submission until every 🚫 item
  is done, since Apple rejects on any one of them.
