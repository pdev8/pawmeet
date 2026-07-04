# Pawk — Pet Events Near You

> Ships as **Pawk** ("PawMeet" was the working title — resolves Open Question 6).
> The name "PawMeet" persists below only where it names the product in prose.

**Status:** Living spec. A v1 demo implements the M0–M2 social core **and most of
the M3 map** on a local mock data layer (zustand + AsyncStorage, no backend). This
document is the product vision + data model; **[BACKLOG.md](BACKLOG.md) is the
source of truth for what's built and what's next**, including the full path to
App Store launch. [AGENTS.md](AGENTS.md) documents the code architecture.
**Last updated:** 2026-07-04

## 1. Problem Statement

Pet owners who want to take their dogs to meetups have no dedicated place to find them. Today these events live almost exclusively on Facebook, buried in groups, with poor discovery: you can't easily search "golden retriever meetups within 15 miles of me in the next two weeks." PawMeet is an iOS app for discovering, posting, and RSVPing to pet events in a given area.

**Primary persona:** A dog owner (e.g. golden retriever owner) who occasionally wants to find a nearby meetup — breed-specific or general — without trawling Facebook groups.

## 2. Goals & Non-Goals

### Goals (v1)
- Search/browse upcoming pet events by **location, radius, and date range**.
- **Post** an event with venue, time, and details.
- **RSVP** to events (Going / Interested).
- **Comment** on events — ask the host questions ("is street parking ok?", "are puppies welcome?") and coordinate publicly.
- Show **attendee badges** (profile avatars of people + their pets) on event cards so browsers can see who's coming before opening the event.
- Support common venue types: **private home/backyard, public park, dog park, business** (pet store, brewery patio, etc.).
- Support **breed-organized** events (e.g. "Golden Retrievers of Austin") as well as all-pets events.

### Non-Goals (v1)
- Android (design the backend to be platform-agnostic, but ship iOS only).
- In-app chat / DMs.
- Ticketing or paid events.
- Scraping/importing Facebook events (legal/ToS risk — revisit later).
- Non-dog pets as a first-class filter (schema supports `species`, but UX is dog-first).

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| App framework | **React Native + Expo** | "Built in React" targeting iOS. Expo gives OTA updates, EAS builds, and native module access. |
| Language | TypeScript | Strict mode. |
| UI system | **Liquid Glass** (iOS 26 design language) | Via `expo-glass-effect` / native `UIGlassEffect` materials for tab bars, cards, sheets. Fallback to blur materials on older iOS. |
| Navigation | Expo Router | File-based routing, native stack + tabs. |
| Maps | Apple Maps (`react-native-maps`, Apple provider) | Native feel; MapKit clustering for event pins. |
| State/data | TanStack Query + Zustand | Server cache vs. local UI state. |
| Backend | Supabase (Postgres + PostGIS, Auth, Storage, Realtime) | PostGIS powers radius search; Realtime powers live RSVP counts. Swappable for Firebase if preferred — decide before build. |
| Geosearch | PostGIS `ST_DWithin` on a `geography` column | Distance-accurate radius queries. |
| Push | Expo Notifications + APNs | Event reminders, RSVP activity on your events. |
| Auth | Sign in with Apple (required by App Store when offering social login) + email | |
| Images | Supabase Storage + on-device compression | Event cover photos, pet/owner avatars. |

### 3.1 Development Environment — Windows + Mac

The developer works from both a Windows PC and a Mac; the toolchain must support day-to-day development natively on either, with no VMs or remote-desktop workarounds.

- **Daily development works identically on both:** Expo's dev server (Metro) runs natively on Windows and macOS. Run `npx expo start`, scan the QR with the iPhone, and iterate with hot reload via **Expo Go** (early on) or a **custom dev client** (once native modules like `expo-glass-effect` and maps are added).
- **iOS native builds:** Apple's toolchain only runs on macOS, so:
  - **Primary path — EAS Build (cloud):** `eas build` works from Windows or Mac; Apple signing is managed by EAS. This makes Windows a first-class dev machine — building the dev client, TestFlight, and App Store submission (`eas submit`) all work from either OS.
  - **Secondary path — local Xcode on the Mac:** for debugging native-layer issues, profiling with Instruments, and faster build iteration when working on native modules.
- **Simulators:** iOS Simulator is Mac-only; on Windows, test on a physical iPhone (which is preferable for glass effects, maps, and location anyway).
- **Parity requirements:** repo must be cross-platform clean — no OS-specific paths in scripts (use Node scripts, not `.sh`/`.ps1`), LF line endings enforced via `.gitattributes`, Node version pinned via `.nvmrc`/volta, all workflows driven through `package.json` scripts that behave identically on both machines.
- **Source of truth:** Git hosting (GitHub) — not file sync (keep the repo outside OneDrive to avoid sync corruption of `node_modules`/`.git`).

## 4. Core Concepts & Data Model

### Entities

**User**
- `id`, `display_name`, `avatar_url`, `home_area` (coarse lat/lng, optional), `created_at`
- Privacy: exact home location never stored; only a user-chosen "home area."

**Pet** (a user can have multiple)
- `id`, `owner_id`, `name`, `species` (dog for v1), `breed` (from canonical breed list), `photo_url`, `size` (S/M/L), `temperament_tags` (optional: "puppy-friendly", "shy", etc.)

**Event**
- `id`, `host_id`, `title`, `description`, `cover_photo_url`
- `starts_at`, `ends_at` (timezone-aware)
- `venue_type`: `home_backyard` | `public_park` | `dog_park` | `business` | `other`
- `location`: `geography(Point)` + display address
  - For `home_backyard`: **approximate pin only** until RSVP is approved; exact address revealed to approved attendees (safety).
- `breed_focus`: nullable breed id (null = all breeds welcome)
- `capacity` (nullable), `rsvp_mode`: `open` | `host_approves` (default `host_approves` for backyard events)
- `status`: `active` | `cancelled` | `archived`
- `archived_at` (nullable)
- `visibility`: `public` | `link_only`

**Event lifecycle:** `active` → `archived` automatically once the event is past (scheduled job archives events ~24h after `ends_at`, giving a grace window for late "great meetup!" comments). Cancelled events archive on the same schedule. Archiving is a state change, not a delete — data is retained.

**RSVP**
- `id`, `event_id`, `user_id`, `pet_ids[]` (which of your pets you're bringing)
- `status`: `going` | `interested` | `waitlisted` | `pending_approval` | `declined_by_host` | `cancelled`
- Unique on (`event_id`, `user_id`).

**Comment**
- `id`, `event_id`, `author_id`, `body` (text, ≤1000 chars), `parent_comment_id` (nullable — one level of replies only), `created_at`, `edited_at`, `deleted_at` (soft delete)
- Author badge context: comments render the author's owner+pet avatar badge plus a "Host" or "Going" chip when applicable.

**Report** (moderation)
- `id`, `reporter_id`, `target_type` (event/user/comment), `target_id`, `reason`, `created_at`

### Key derived data
- `attendee_preview`: first N (≈5) going-attendee avatars + count, denormalized onto event list queries — this powers the **badge row** on cards.
- `distance_km`: computed per-query from the searcher's location.

## 5. Features

### 5.1 Discovery / Search (the core screen)
- **Two views, one screen:** list ⇄ map toggle (map uses clustered pins; Liquid Glass floating toggle).
- **Location input:** current GPS location (permission-gated) or a searched place ("Austin, TX", zip).
- **Filters** (glass filter bar / bottom sheet):
  - Radius: 5 / 10 / 25 / 50 mi (default 15 mi)
  - Date: Today / This weekend / Next 7 days / Next 30 days / custom range (default: next 30 days)
  - Breed: any, or specific breed (typeahead over canonical list) — "Golden Retriever" should surface both golden-focused events *and* all-breed events, with breed-focused ones badged
  - Venue type: multi-select
  - Toggle: "Has spots left"
- **Sort:** soonest (default), nearest, most attendees.
- Discovery only ever queries `status = active` events with a future `starts_at` — archived and cancelled events never appear in search, map, or alerts.
- **Event card contents:** cover photo, title, date/time (relative: "Sat · 10 AM"), distance ("3.2 mi"), venue-type chip, breed chip if breed-focused, and the **attendee badge row** — overlapping circular avatars of up to 5 going attendees (owner photo with a small pet-photo badge overlay) + "+12 going".
- Empty state: prompt to widen radius/dates, and CTA to *host* the first event in the area.

### 5.2 Event Detail
- Hero cover photo with Liquid Glass overlay for title/date.
- Time (with add-to-calendar), venue type, map snippet, distance from user.
- Full attendee section: horizontally scrollable owner+pet avatar badges, grouped by Going / Interested; tap a badge → mini profile (owner + their pets).
- Host card (name, avatar, # events hosted).
- Description (markdown-lite: line breaks, links).
- Breed focus banner if applicable ("Golden Retrievers — all friendly dogs welcome" style host-configurable subtitle).
- **RSVP bar** pinned at bottom (glass): Going / Interested; if `host_approves`, shows "Request to join" → `pending_approval`.
- Address reveal rules: public venues show full address always; `home_backyard` shows neighborhood-level pin until you're an approved attendee.
- **Comments section** (below description): threaded one level deep, newest-first top-level with replies inline; comment count also surfaces on the event card ("💬 8"). See 5.5.
- Share sheet (deep link), report event, cancelled-state banner.

### 5.3 Post an Event
- Multi-step glass sheet flow:
  1. Basics — title, description, cover photo (or pick from provided themed defaults)
  2. When — date, start/end time (validate: must be future; warn if >6 months out)
  3. Where — venue type; address autocomplete (MapKit search); for backyard events, explain the approximate-pin privacy behavior
  4. Who — breed focus (optional), capacity (optional), RSVP mode (open vs. approval; approval forced-on suggestion for home venues)
  5. Review & publish
- Hosts can edit (attendees notified of time/place changes) or cancel (attendees notified).
- Host dashboard on the event: approve/decline requests, see attendee + pet list, headcount incl. dogs.

### 5.4 RSVP & Attendance
- RSVP selects which pet(s) you're bringing (defaults to your only pet).
- Capacity handling: full events offer waitlist; auto-promote in join order on cancellations (push notification on promotion).
- Reminders: push at 24h and 2h before events you're Going to; "starts soon" includes travel-time hint.
- **Post-event archiving:** ~24h after `ends_at`, a scheduled job archives the event. Archived events:
  - Disappear from Discovery search, map, and saved-search alerts entirely.
  - Remain viewable via direct link and on profiles ("Past" tab for attended events, hosted-events history for hosts) with an "Archived" glass banner.
  - Become **read-only**: no new RSVPs; comments lock after the 24h grace window (attendees can post "great meetup!" recaps during the grace period).
  - Exact-address reveal for `home_backyard` events is scrubbed from client responses once archived (only neighborhood-level location retained in the API payload).
  - Still count toward badges/stats (hosted count, "5 Events," etc.).
- Hosts can't edit archived events, but can **"Host it again"** — one-tap clone into the post-event flow with everything prefilled except date.
- (v2: photos/recap thread on archived events.)

### 5.5 Comments
- Any signed-in user can comment on a public event; `link_only` events allow comments from anyone with the link.
- **Structure:** top-level comments + one level of replies (no deep nesting). Newest-first for top-level; replies chronological.
- **Composer:** glass input bar pinned above the RSVP bar when the comments section is in view; @-mention the host (v1 limits mentions to host only — full mentions are v2).
- **Author context chips:** each comment shows the owner+pet badge, plus "Host" chip on host comments (visually distinct, e.g. amber outline) and "Going" chip for confirmed attendees — so answers from the host are scannable.
- **Edit/delete:** authors can edit (shows "edited") and soft-delete their own comments; hosts can delete any comment on their event (shows "removed by host"); deleting keeps thread structure intact.
- **Host Q&A affordance:** hosts get a notification and an inline "Reply" CTA for unanswered top-level comments on their events.
- **Realtime:** new comments appear live while the event screen is open (Supabase Realtime).
- **Abuse controls:** report comment, blocked users' comments hidden both directions, rate limit (e.g. 10 comments/min/user), max 1000 chars, links allowed but not previewed in v1.

### 5.6 Profiles & Badges
- **Owner profile:** avatar, name, home area (coarse), pets, upcoming events, hosted-events count.
- **Pet profile:** photo, name, breed, size, temperament tags.
- **Badge component** (reused everywhere): circular owner avatar with a small overlapping pet avatar at the bottom-right corner; stacks with -8px overlap in rows; "+N" overflow chip. This is the signature visual for "see who's coming."
- Achievement badges (lightweight, v1.5): "First Meetup," "Host," "5 Events," "Breed Ambassador" — shown as small icons on profile and next to name in attendee lists.

### 5.7 Notifications
- Push + in-app inbox: RSVP approved, event reminder, event changed/cancelled, waitlist promoted, someone RSVP'd to your hosted event (batched), new event matching a **saved search** (e.g. "goldens within 25 mi" — this is the retention hook).
- Comment notifications: new comment on your hosted event, reply to your comment, host replied on an event you're attending (batched per event to avoid spam).

### 5.8 Onboarding
1. Sign in with Apple / email
2. Create owner profile (name, photo)
3. Add pet(s) — name, breed (typeahead), photo
4. Location permission ask (with clear value framing) or manual home area
5. Optional: create a saved search from their breed + area → drops them onto Discovery pre-filtered

### 5.9 Dog-friendly places map & reviews  *(added post-spec; implemented in v1 demo)*
Distinct from the Discovery event map — this is a standalone map of **where you
can take your dog**, sourced live from OpenStreetMap (no API key).
- **Areas:** dog parks, parks, nature reserves, beaches, and named trails,
  fetched from Overpass around a searched or GPS center. Rendered as
  color-coded, crosshatched polygons (trails as dashed lines), one hue per
  category so a filter chip matches the areas it toggles. Filters scroll on a
  single row; larger areas and every dog park get a Pawk pin.
- **Place detail:** OSM opening hours, a blended star rating, "Open in Apple
  Maps" / website links.
- **Community reviews:** rate (1–5) + text; add, edit, and delete your own,
  multiple per place, newest-first. (Demo: mixed with deterministic sample
  reviews from the mock community and blended into the rating.) *Backend
  persistence, photos, and review reporting are tracked in BACKLOG Epic 3.*

## 6. UI / Design System — "Liquid" Direction

- **Materials:** Liquid Glass (iOS 26) for chrome — tab bar, filter bar, RSVP bar, sheets, map overlays. Content (cards, photos) stays opaque for readability; glass is for the layer *above* content.
- **Tab bar:** floating glass capsule — Discover · Map (or merged into Discover) · Post (+) · Inbox · Profile.
- **Motion:** spring-based transitions (Reanimated); cards lift on press; sheet presentations use native detents; avatar badge rows animate in with a subtle cascade.
- **Type/color:** SF Pro / SF Rounded for friendly headers; warm palette (goldens-inspired amber accent) on system backgrounds; full dark-mode support (glass adapts automatically).
- **Accessibility:** respect Reduce Transparency (glass → solid fills) and Reduce Motion; Dynamic Type throughout; 44pt touch targets; avatar badges need accessible labels ("Sam and Biscuit, going").
- **Graceful degradation:** on iOS < 26, glass surfaces fall back to `UIBlurEffect` materials — visually consistent, no feature loss.

## 7. Trust, Safety & Privacy

- Approximate location for home-hosted events until host approves attendee.
- Host approval mode default-on for `home_backyard`.
- Report event/user/comment; blocked users' events, RSVPs, and comments are mutually hidden.
- Hosts moderate their own event's comment threads (delete); repeated host-deletions of a user's comments feed the moderation queue signal.
- New-account friction for hosting home events (e.g. must have attended 1 event or verified phone) — decide threshold.
- Location data: store search locations transiently; never expose exact user location to other users.
- COPPA/age gate: 17+ or parental wording (events involve meeting strangers). Standard ToS + community guidelines ("vaccinated & leashed unless venue allows," etc. — guidance text on every event).
- App Store: expect review scrutiny on user-generated content → need report/block + moderation queue (a simple admin web view is fine for v1).

## 8. Non-Functional Requirements

- Search p95 < 500ms for radius+date queries (PostGIS GIST index on location, btree on `starts_at`; partial index on `status = 'active'` since discovery never touches archived rows).
- **Archival job:** Supabase scheduled function / `pg_cron` running hourly — archives events with `ends_at < now() - 24h`; idempotent.
- Discovery list paginated (cursor-based, 20/page); map queries viewport-bounded.
- Offline: cached last search results viewable; RSVP requires connectivity (queued optimistic write is v2).
- Image uploads compressed client-side to ≤ ~500KB.
- Analytics: search-to-detail rate, detail-to-RSVP rate, events created/week, saved-search creation (privacy-respecting, e.g. PostHog).
- Crash reporting: Sentry.

## 9. Milestones

> **Status against these milestones lives in [BACKLOG.md](BACKLOG.md).** In short:
> M0–M2 and most of M3 are built **on a mock data layer** (zustand + AsyncStorage);
> the outstanding work is the real backend (BACKLOG Epic 1), push (Epic 8),
> saved-search alerts (Epic 4), and the full launch track (Epic 15). "Built" below
> means the UX + business rules exist against mock data, not against a server.

**M0 — Foundation:** ✅ built (mock) — profiles + pets, design tokens, glass component kit. ⏳ real auth = Epic 1.
**M1 — Events core:** ✅ built (mock) — Discovery list + filters, event detail, post-event flow. ⏳ PostGIS search API = Epic 1.
**M2 — Social layer:** ✅ built (mock) — RSVP incl. approval + waitlist, attendee badges, comments + host moderation, host dashboard. ⏳ realtime + push = Epics 7/8.
**M3 — Map & polish:** ◐ partial — ✅ dog-friendly map + reviews (§5.9), animations; ⏳ saved searches + alerts (Epic 4/8), map⇄list toggle, full a11y pass (Epic 12).
**M4 — Ship:** ⏳ the entire launch track = **BACKLOG Epic 15** (App Store submission, legal, prod ops, observability, launch content).

## 10. Open Questions

1. **Backend:** Supabase (spec'd) vs. Firebase vs. custom API — still open; first task of BACKLOG Epic 1.
2. **Map+list merged** on one Discovery screen (Airbnb-style) vs. separate tabs? — *Current:* the dog-friendly places map is a **separate pushed screen**; a map⇄list toggle on Discovery is still open (BACKLOG Epic 4).
3. Should "Interested" attendees appear in the card badge row, or only "Going"? — *Current:* Going only, per spec.
4. Saved-search alerts in v1 or v1.1? — deferred; tracked in BACKLOG Epics 4 (saved searches) + 8 (alerts).
5. Host verification threshold for home events — how much friction? — still open (BACKLOG Epic 6).
6. ~~Name: "PawMeet" is a placeholder.~~ **Resolved → Pawk.**
7. Monetization later (featured events? breed-club accounts?) — out of scope for now but may influence schema.
