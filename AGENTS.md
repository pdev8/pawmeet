# Pawk — guidance for coding agents

Pawk is an iOS-first pet-events app (discover / post / RSVP / comment) built with
Expo + React Native + TypeScript. [SPEC.md](SPEC.md) is the product source of truth;
[README.md](README.md) lists what's deliberately mocked in this v1 demo build.

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
npx tsc --noEmit                           # typecheck — run after every change; there are no tests
npx expo export --platform ios --output-dir dist-check   # verifies the bundle compiles; delete dist-check after
npx expo lint                              # eslint
npx expo install --fix                     # realign dependency versions to the SDK
```

There is no test suite. Verification = typecheck + bundle export + the user
running it on-device. Nobody can run the iOS app on this Windows machine.

## Architecture

**Mock backend in a zustand store.** There is no server. `src/lib/store.ts` is
the single source of truth: all entities (users, pets, events, rsvps, comments,
notifications) live in one persisted store (AsyncStorage key `pawmeet-demo-v1`).
Store actions encode the business rules a backend would own:

- `archiveSweep()` — events auto-archive 24h after `endsAt`; called on app
  start from the root layout. Archived events: hidden from discovery, comments
  locked, backyard addresses scrubbed.
- `rsvp`/`requestJoin`/`cancelRsvp` — capacity → waitlist, waitlist promotion
  on cancellation, host-approval flow. `requestJoin` on someone else's event
  schedules a fake host approval ~6s later (setTimeout); `addComment` on someone
  else's event schedules a canned host reply ~7s later. These simulate backend
  liveness — keep them when adding features, replace them when a real backend lands.
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
`event/[id]` detail. The Post tab is a 5-step wizard that also serves
"Host it again" via `store.draft`.

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
