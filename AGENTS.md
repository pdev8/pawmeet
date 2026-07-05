# Pawk — guidance for coding agents

Pawk is an iOS-first pet-events app (discover / post / RSVP / comment) with a
dog-friendly places map, built with Expo + React Native + TypeScript.

- [SPEC.md](SPEC.md) — product vision + data model (the "what/why").
- [BACKLOG.md](BACKLOG.md) — current state + roadmap to App Store launch (the
  "what's done / what's next"); the single source for status.
- [README.md](README.md) — how to run it + a demo tour of what to try.
- This file (AGENTS.md, included by CLAUDE.md) — how the code is structured.

## Hard constraint: Expo SDK 54, pinned to Expo Go

The project targets **SDK 54** because that's what the App Store build of Expo Go
supports — the user tests on a physical iPhone via Expo Go, with no dev build.
Expo docs for this version: https://docs.expo.dev/versions/v54.0.0/

- Do NOT upgrade `expo` or SDK-coupled packages until Expo Go on the App Store
  supports a newer SDK.
- Add native dependencies only if they're bundled in Expo Go. Install with
  `npx expo install <pkg>` so versions pin to SDK 54.
- Plain `npm install` needs `--legacy-peer-deps` (datetimepicker peer conflict).
- SDK 54 API quirks already handled in this codebase: NativeTabs uses named
  `Label`/`Icon`/`Badge` exports from `expo-router/unstable-native-tabs`;
  navigation themes come from `@react-navigation/native`, not `expo-router`.

## Commands

```
npm start                                  # Expo dev server; scan QR with Expo Go (same Wi-Fi; --tunnel if blocked)
npx tsc --noEmit                           # typecheck — run after every change
npm test                                   # vitest — unit tests for pure logic in src/lib
npx expo export --platform ios --output-dir dist-check   # verifies the bundle compiles; delete dist-check after
npx expo lint                              # eslint (eslint + eslint-config-expo are installed)
npx expo install --fix                     # realign dependency versions to the SDK
```

Verification = typecheck + `npm test` + bundle export + the user running it
on-device. The `/verify-ios` skill runs all three checks + cleanup in one step.
Tests (Vitest, `src/lib/*.test.ts`) cover the pure logic only — geometry
(`hatch`), review math (`reviews`), OSM categorization/rating (`places`), and the
store's review business rules; they run in plain Node with AsyncStorage mocked
(`test/mocks/`, aliased in `vitest.config.ts`), so they never touch Metro/Expo and
leave the SDK-54 pin alone. The RN components and the running app can only be
exercised on the user's iPhone via Expo Go — neither this machine nor CI can.

## Architecture

**Mock backend in a zustand store.** There is no server. `src/lib/store.ts` is
the single source of truth: all entities (users, pets, events, rsvps, comments,
notifications) live in one persisted store (AsyncStorage key `pawmeet-demo-v1`).
Store actions encode the business rules a backend would own:

- `archiveSweep()` — events auto-archive 24h after `endsAt`; called on app
  start from the root layout. Archived events: hidden from discovery, comments
  locked, backyard addresses scrubbed.
- `rsvp`/`requestJoin`/`cancelRsvp` — capacity → waitlist, waitlist promotion
  on cancellation, host-approval flow. These mock-store paths now serve only the
  seed/demo events; real (Supabase) events go through the TanStack Query hooks in
  `use-rsvps.ts`/`use-comments.ts`. The old `setTimeout` "backend liveness" fakes
  (a ~6s auto host-approval in `requestJoin`, a ~7s canned host reply in
  `addComment`) have been retired now that host approve/decline and comments are
  real — seed events simply won't auto-respond.
- `reseed(center, label)` — regenerates all demo data from `src/lib/seed.ts`
  around a geo center (real GPS on first launch, else Austin), preserving the
  user's profile/pets.

**Reading state:** selectors in `src/lib/selectors.ts` and the discovery query
in `src/lib/filters.ts` are plain functions taking the state object (not hooks) —
components call `useStore()` then pass the store in. Key domain logic lives
there: `visibleAddress()` (backyard privacy: exact address only for host and
approved attendees, never once archived) and `discoverEvents()` (radius via
haversine, date windows, breed filter that inclusively matches all-breeds events).

**Routing:** Expo Router, `src/app/` (note `src/` root, alias `@/*` → `src/*`).
Root Stack → `(tabs)` (native tabs: Discover / Post / Inbox / Profile) →
`event/[id]` detail and the `map` screen (pushed from Discover). The Post tab is
a 5-step wizard that also serves "Host it again" via `store.draft`.

**Dog-friendly map (`src/app/map.tsx`).** Live OpenStreetMap data, no API key:
`src/lib/places.ts` queries Overpass for dog parks / parks / nature reserves /
beaches / trails around a center (and Nominatim for the search box); results are
capped for map perf. Each category has one distinct hue in `CATEGORY_COLORS`
(green/teal/olive/blue/orange) that drives the polygon fill, outline, hatch, and
the filter chip together, so a chip visually matches the areas it toggles.
`src/lib/hatch.ts` scan-line-clips crosshatch segments to each polygon (density
tuned by `spacingM` / `maxLinesPerDirection`). Place detail sheet shows OSM hours
+ **community reviews**: `placeReviews` in the store (keyed by place id, one entry
per review — add / edit / delete your own, multiple per place) merged newest-first
above deterministic demo reviews from `demoReviews()`, blended into a headline
rating. The review composer is inline in the sheet, lifted over the keyboard with
`KeyboardAvoidingView` (the sheet floats at the bottom over the map).

**Web preview.** The app is iOS-first, but `metro.config.js` adds a web-only
resolver (react-native-maps → empty, zustand → CJS build) and `map.web.tsx` is a
placeholder so `npx expo start --web` bundles for testing non-map flows in a
browser. Native builds are unaffected — the resolver only branches on
`platform === 'web'`.

**UI system:** palette in `src/constants/theme.ts` via `usePalette()` (light +
dark, amber accent). `Glass` (`src/components/glass.tsx`) is the Liquid Glass
surface with fallback chain: native GlassView (iOS 26) → BlurView (older iOS) →
translucent View. `Icon` renders SF Symbols only (blank View on Android —
the app is iOS-first). `OwnerPetBadge` (owner avatar + pet peeking from the
corner) is the signature visual, stacked by `BadgeRow` on event cards.

**Logo & animations:** `src/components/logo.tsx` exports the retriever head
path and per-ear pose keyframes shared with `refresh-logo.tsx`. Ears animate by
morphing the SVG `d` attribute via `Animated` string interpolation — this
requires `useNativeDriver: false`. Pull-to-refresh on Discover is fully custom
(deliberately no `RefreshControl` — its spinner can't be reliably hidden):
scroll offset drives the mascot's position/ears during the pull, then a phase
state machine (`shake` → `spin` → `idle`) in `src/app/(tabs)/index.tsx` runs the
wet-dog shake, comic spin finale, and an animated list spacer so cards never
overlap the mascot.

## Environment notes

- Developed from Windows and Mac; keep scripts cross-platform (Node, not shell).
- Remote images come from placedog.net / i.pravatar.cc — device needs internet.
