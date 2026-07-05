# Pawk Admin console

A small static web app for operating Pawk against the live Supabase backend.
This is the **start** of the admin dashboard — v1 is read-only (Operations /
Events / Users); moderation + a real admin role land with Epic 11.

Separate from the Expo app on purpose: it's a browser tool for operators, not a
screen in the iOS app. No build step, no framework — plain HTML/CSS/JS loading
`@supabase/supabase-js` from a CDN.

## Run it

```
cp admin/config.example.js admin/config.js   # then fill in URL + anon key
npx serve admin                               # http://localhost:3000
```

Serve it over HTTP (don't open `index.html` via `file://` — the CDN import and
Supabase auth need a real origin). Any static host works: `npx serve`,
`python3 -m http.server`, etc.

`admin/config.js` is gitignored (mirrors the app's `.env` policy). The anon key
is public-by-design — RLS is what protects the data.

## Sign in

Use any Pawk account (Supabase email/password). **v1 authenticates as a normal
user** and shows what row-level security allows any authenticated user to read
(profiles, events, RSVPs, comments are world-readable to signed-in users). A
dedicated `is_admin` role + write/moderation access is deferred to the
moderation epic.

## Panels

- **Operations** — event-data health (active / archived / *awaiting archival*)
  and the pg_cron archival job, with the enable/schedule runbook. The sweep
  (`archive_past_events()`) is server-side only, so it's triggered by cron or the
  SQL Editor, never from here.
- **Events** — newest events with status filter, host, venue, area.
- **Users** — profiles (name, home area, join date).

## Deploy (later)

Any static host (Vercel, Netlify, Cloudflare Pages) pointed at `admin/`. Provide
`config.js` via the host (it's gitignored), or inline the public values at deploy
time. Add access control (admin allowlist / SSO) before exposing it publicly.
