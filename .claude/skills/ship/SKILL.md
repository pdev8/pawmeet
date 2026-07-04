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

Notes:
- `args` (optional): a short hint to fold into the commit message / scope.
- If auth fails, surface it and stop — don't retry blindly.
