# Pawk — Backlog

Agile backlog for taking Pawk from the v1 mock-data demo toward launch. This is
the **source of truth for status**; the other docs cover different angles:

| Doc | Answers |
|---|---|
| [SPEC.md](SPEC.md) | product vision + data model (what/why) |
| **BACKLOG.md** (this) | what's built + what's next (status/roadmap) |
| [AGENTS.md](AGENTS.md) | how the code is structured (for coding agents) |
| [README.md](README.md) | how to run it + a demo tour |

## Current state (2026-07-05)

Running on a **real Supabase backend** (Postgres + PostGIS + RLS + Storage) via
TanStack Query hooks; the old zustand mock store now only backs seed/demo events
and a fallback path. **Epic 1 (backend) and Epic 11 (trust & safety) are complete.**
- **Events:** discover (server-side `nearby_events` PostGIS radius + client date/
  breed/venue filters/sorts), post (5-step wizard, real cover-photo upload),
  event detail, hourly archival via pg_cron, "Host it again".
- **Social:** real RSVP (capacity → waitlist, host approve/decline from Inbox),
  threaded comments with host moderation, going counts + attendee strips, user
  profiles (tap attendee/host/commenter) with report + block.
- **Trust & safety:** report events/users/comments → **admin moderation queue**
  (`admin/` console, `admins` allowlist + `is_admin` RLS); block user (mutual
  hide); age gate (17+) + community guidelines.
- **Dog-friendly map:** live OSM areas (dog parks / parks / reserves / beaches /
  trails), color-coded polygons + hatch + chips, place detail with hours, and
  **community reviews persisted to Supabase** (all users, real timestamps, count).
- **Photos:** Supabase Storage (`photos` bucket) — pet photos + event covers.
- **Admin console:** `admin/` static web app — Operations / Moderation / Events / Users.
- **Demo data:** an Orange County seed (15 users, 14 events, RSVPs, comments, 53
  place reviews) lives in the linked project — see `scripts/` + the `/seed-demo` skill.
- **Tooling:** 138 Vitest tests; ESLint; web preview bundles.

Remaining before launch is mostly Epic 15 (App Store submission / legal / ops) plus
polish epics. Sign in with Apple (Epic 1) is deferred pending a dev build; native
email/password is a placeholder for SSO. Milestone mapping lives in [SPEC.md §9](SPEC.md).

**Legend:** 🟢 independent (grab anytime) · 🔴 blocks/unblocks others · ⭐ suggested next · 🚫 App Store submission blocker (Apple rejects without it)

---

## EPIC 1 — Backend & Auth  🔴 (unblocks most "real data" work)
- [x] Decide backend: Supabase (Postgres + PostGIS)
- [x] Stand up schema: profiles, pets, events, rsvps, comments, reports + place_reviews / favorites / saved_searches / notifications, with RLS (merged PR #5)
- [x] Email auth (Supabase email/password + login gate, PR #7) — works in Expo Go
- [ ] Sign in with Apple  🚫 — needs a custom dev build (deferred while pinned to Expo Go)
- [x] In-app account deletion flow — `delete_current_user` RPC + ON DELETE CASCADE (verified end-to-end); meets the Apple requirement
- [x] Swap zustand mock store → real data layer (TanStack Query) — client (#6), Profile (#9), Pets (#10), Place reviews (#11), Events (#12), RSVP core (#13), Comments (#14), attendee badges + going counts (#15), host approve/decline (#16) — all verified e2e
- [x] Replace mock timers (host approval ~6s, canned replies ~7s) with real writes — retired the setTimeout fakes; real writes via use-rsvps/use-comments (#17)
- [x] PostGIS radius search — `nearby_events(lat,lng,radius)` RPC now drives Discover server-side (#18); haversine only computes display distance
- [x] Scheduled archival job — `archive_past_events()` scheduled hourly via pg_cron (#19, applied to the linked project)

## EPIC 2 — Map & Places  🟢
- [x] Persist filter selections across sessions — category + Events toggles persist via the store (#35)
- [x] Cluster pins when zoomed out (many places overlap) — supercluster over place + event pins; tap → grouped card (#38, reworked #39)
- [ ] ⭐ **Clustering polish (future enhancement)** — the sticky-drag glide still isn't as fluid as we want and clusters don't always behave as expected on zoom/pan. Revisit: tune the AnimatedRegion glide (duration/easing) + `tracksViewChanges` window in `src/app/map.tsx`, and the `radius`/`maxZoom` in `src/lib/cluster.ts`; consider recomputing clusters on `onRegionChange` (live) rather than only `onRegionChangeComplete`, or a purpose-built clustering lib.
- [x] Cache Overpass results so re-opening the map isn't a cold fetch — 5-min per-center cache (#36)
- [x] Loading / empty / error states polish for "search this area" — Retry on error + distinct empty state (#36)
- [x] Show event pins on the map (tie Discover events → map) — accent paw pins + Events toggle (#34); pins follow the Discover area, region refetch is a follow-up
- [x] Legend / key for the category colors — floating key button → legend card (#35)

## EPIC 3 — Place Reviews (extend what's built)  🟢 ⭐
- [x] Persist reviews to backend — community reviews (all users) via `place_reviews`, author profiles embedded (#26)
- [x] Real relative timestamps instead of "Just now" — `timeAgo` on real reviews (#26)
- [x] Show review count next to the star rating — "N reviews" in the place sheet (#26)
- [x] Attach a photo to a review — `place_reviews.photo_url` + composer photo picker; renders in review rows (#37)
- [x] Report / flag a review — `'review'` report target + flag action on community reviews → moderation queue (#46)

## EPIC 4 — Discovery / Search  🟢 ⭐
- [x] "Has spots left" toggle — already in the filter sheet
- [x] Empty-state CTA: "host the first event in this area" — already wired
- [x] Real place geocoding for the area picker (Nominatim) — shipped: inline collapsible search + loading UX + location-varied demo events
- [ ] Saved searches ("goldens within 25 mi") — deferred to a future enhancement (built + tested on branch `epic4/saved-searches`, PR #3 closed); alerts need Epic 8
- [x] Favorite / bookmark events → a Saved list (heart on cards + event detail; collapsible Saved section on Profile)
- [ ] Map ⇄ list toggle on the Discover screen — deferred: needs device-in-loop (touches the pull-to-refresh animation)

## EPIC 5 — Post / Host an Event  🟢
- [x] Address autocomplete in the Where step — Nominatim suggestions → real pin; posted/edited events get real coords (#32)
- [x] Real cover-photo upload — Storage foundation (public `photos` bucket + RLS, `uploadPublicImage`/`pickImage`, #29) + Upload tile in the Post wizard (#30); placedog presets kept as quick options
- [x] Edit event — hosts edit their event via the Post wizard (#31); attendees get an in-app "event updated" notification on save (#41). Push delivery + address relocation are follow-ups
- [x] Host dashboard: attendee + pet list, headcount incl. dogs — `manage/[id]` screen with status groups + inline approve/decline (#33)
- [x] Recurring events (weekly / biweekly / monthly) — recurrence option in the post wizard; auto-advances to the next occurrence instead of archiving

## EPIC 6 — RSVP & Attendance  🟢
- [~] ~~Choose which pet(s) you're bringing on RSVP~~ — **won't do** (product decision, 2026-07-05); `rsvps.pet_ids` stays unused
- [x] Add-to-calendar from event detail — native Add Event sheet via expo-calendar (#42)
- [ ] New-account friction for hosting backyard events (attended 1 / verified phone)

## EPIC 7 — Comments  🟢
- [ ] Realtime new comments while the event screen is open
- [x] "Host" / "Going" author context chips — live on Supabase-backed comments (#14)
- [x] 1000-char cap enforcement — DB CHECK + client maxLength (#14); rate limit still TODO
- [x] Report a comment — shipped with in-app reporting (#20)

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
- [x] Pet profile screen (photo, breed, size, temperament tags) — pets shown on the user profile (#27), photo upload (#29), and editable temperament tags on add/edit (#40)
- [x] Achievement badges — 8 badges (`computeAchievements`, derived from activity, unit-tested) rendered as interactive 3D **dog collars**: `expo-gl`+`three` single-canvas grid, extruded-ring straps with painted nylon/stripe/spot textures, assorted metal buckles with a clip seam, ice-cream colors, accelerometer tilt, drag/tap spin (`src/components/achievements.tsx`, #achievements-3d)
- [x] Tap attendee badge → mini profile — user profile screen from attendee strips, comment authors, and the event host (#27, #28), with report/block

## EPIC 11 — Trust, Safety & Moderation  🟢 (launch-critical for a UGC app)
- [x] Report event / user / comment  🚫 (UGC apps need report or Apple rejects) — event + comment (#20) + user (#27) reporting; admin queue (#21) is the operator half
- [x] Block user (mutual hide of events, RSVPs, comments)  🚫 — `blocks` table + mutual-hide across discovery/comments/attendees; block from a comment, unblock from Profile (#25)
- [x] Simple admin moderation-queue web view + a process/owner for reviewing reports — `admins` allowlist + `is_admin` RLS + Moderation panel (resolve/dismiss) in `admin/` (#21); grant admins via SQL insert
- [x] Age gate (17+) + community guidelines text on events  🚫 — one-time 17+ gate + guidelines screen (Profile + every event) (#23)

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
