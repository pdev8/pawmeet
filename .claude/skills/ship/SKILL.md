---
name: ship
description: Run the verification gate, then commit the working tree in logical commits and push to main. Use when the user has reviewed changes and wants them landed — the one-word replacement for typing "commit and push". Optional args = a short scope/message hint.
---

# Ship — verify → commit → push

Paul reviews changes in Expo Go on-device first, then lands them. Invoke this
only when he asks to land work (`/ship`), never proactively.

## 1. Verify
Run the `verify-ios` gate unless the diff is docs/config only with no runtime
surface:

```
npx tsc --noEmit
npm test
npx expo export --platform ios --output-dir dist-check && rm -rf dist-check
```

If anything fails, **stop and report** — do not commit broken work.

## 2. Group the diff
`git status` + `git diff --stat`. Split into logical commits rather than one
blob — e.g. feature/refactor (+ its tests) in one commit, and unrelated tooling
/ lockfile churn or docs in another.

## 3. Commit each group
Imperative subject ≤ ~72 chars, a body explaining what + why. End every message
with the trailer:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## 4. Push
`git push origin main` (HTTPS remote `github.com/pdev8/pawmeet`). Report the
commit hashes and a one-line summary of what landed.

## 5. Sync the backlog tracker (only if the backlog changed)
If this ship marked backlog items complete, added items, or otherwise changed
`BACKLOG.md`, refresh the shared tracker artifact so it isn't stale:

1. Edit `docs/backlog-tracker.html` to match `BACKLOG.md` — in the `DATA` array,
   set `done: true` on completed tasks, add new tasks, and mirror the epic order.
   (Completed tasks open pre-checked; the `CHECK_KEY`/`UI_KEY` version only needs
   bumping if task ids shift, e.g. reordering/removing tasks.)
2. Re-publish to the SAME url with the Artifact tool:
   `Artifact({ file_path: "docs/backlog-tracker.html", url: "https://claude.ai/code/artifact/3884c9cc-b2ac-4476-b796-7b9b973782e5", favicon: "🐾" })`
   Passing `url` targets the existing artifact instead of minting a new one.
3. Commit `docs/backlog-tracker.html` alongside the `BACKLOG.md` change.

If the ship didn't touch the backlog, skip this step.

Notes:
- `args` (optional): a short hint to fold into the commit message / scope.
- If auth fails, surface it and stop — don't retry blindly.
- The tracker is a static page — it only reflects reality when re-published; it
  can't sync on its own.
