---
name: verify-ios
description: Verify a code change compiles for this Expo SDK-54 project — runs the TypeScript typecheck and the iOS bundle export, then cleans up. Use after any code change and before committing; there is no test suite so this is the verification gate. Skip for doc-only or config-only changes with no runtime surface.
---

# Verify (Pawk, Expo SDK 54)

There is no test suite. The verification gate for this repo is: **the TypeScript
typecheck passes AND the iOS bundle exports cleanly.** Run both from the repo root.

```
npx tsc --noEmit
npx expo export --platform ios --output-dir dist-check
```

Then remove the throwaway output directory:

```
rm -rf dist-check
```

## Reading the result
- **Typecheck passes** = `tsc` exits 0 with no output. Any `error TS…` line must be fixed first.
- **Export passes** = it ends with `Exported: dist-check` and lists a written `.hbc` bundle. A red stack trace = a bundle/runtime import problem to fix.

## Notes
- This does **not** run the app. Only the user's iPhone (Expo Go) can exercise the
  running app — neither this machine nor CI can.
- Lint is separate and optional: `npx expo lint`.
- Do the export step even when only the typecheck seems relevant — some breakages
  (bad imports, web/native resolver issues) only surface at bundle time.
- Skip this skill entirely for doc-only / config-only changes.
