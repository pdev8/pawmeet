---
name: run-on-phone
description: Start the Expo dev server and produce a scannable QR / exp:// URL so the user can open Pawk in Expo Go on their iPhone. Use when asked to run, start, or preview the app on the phone/device. This shell is non-interactive, so Expo cannot print its own QR — generate one.
---

# Run Pawk on the iPhone (Expo Go)

Pawk is pinned to **Expo SDK 54** and runs via **Expo Go** on the user's physical
iPhone — no dev build, no simulator on this machine. This shell is
non-interactive, so `expo start` can't prompt (a second instance dies on the
"use another port?" prompt) or reliably print a scannable QR. Do this instead:

## 1. Start the dev server (background)
Clear the port first so you own port 8081, then start in the background:
```
lsof -ti:8081 | xargs kill -9 2>/dev/null; true
npm start        # run_in_background: true
```
Wait ~10s, then confirm it's up:
```
curl -s localhost:8081/status        # → packager-status:running
```

## 2. Build the connection URL
```
ipconfig getifaddr en0 || ipconfig getifaddr en1
```
The Expo URL is `exp://<IP>:8081`.

## 3. Make it scannable
A terminal QR (ANSI blocks) does **not** render in the chat UI — generate a PNG:
```
npx -y qrcode "exp://<IP>:8081" -o <scratchpad>/expo-qr.png
open <scratchpad>/expo-qr.png
```
Open it (or send it with SendUserFile) and also give the `exp://<IP>:8081` URL so
the user can type it into Expo Go → "Enter URL manually".

## Requirements & fallback
- iPhone and this Mac must be on the **same Wi-Fi**.
- If the network blocks device-to-device traffic, restart with a tunnel:
  `npm start -- --tunnel` (slower to load, but works across network isolation).
