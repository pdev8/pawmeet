---
name: sync
description: One-shot "ship it and land it" — verify, commit, push, open a PR, squash-merge to main, then refresh the backlog + tracker. Use when Paul says "sync": he's reviewed the change on-device and wants it all the way to main in one step (this is /ship + merge combined). For just a PR without merging, use /ship instead.
---

# Sync — verify → commit → push → PR → merge → backlog

Paul reviews on-device, then says "sync" to land the work in one shot. This is
`/ship` plus an immediate squash-merge and the post-merge backlog refresh.
Only skip the manual review gate because he asked ("sync" = "I've reviewed it").

## 1. Verify
Run the `verify-ios` gate unless the diff is docs/config-only with no runtime surface:
```
npx tsc --noEmit
npm test
npx expo export --platform ios --output-dir dist-check && rm -rf dist-check
```
If anything fails, **stop and report** — never merge broken work.

## 2. Branch + commit
If currently on `main` with changes, create a feature branch first (`epicN/<slug>`).
Group into logical commits (feature/refactor + its tests separate from unrelated
tooling/docs). End every message with:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## 3. Push → PR → merge
```
git push -u origin <branch>
gh pr create --fill --base main --head <branch>     # or reuse an existing PR
gh pr merge <PR#> --squash --delete-branch
git checkout main && git pull origin main
```
`gh` lives at `/opt/homebrew/bin` (auth in keyring). If a merge conflict or a
failed check appears, stop and surface it rather than forcing.

## 4. Backlog + tracker (if the merge completed or added a backlog item)
Same as `/ship` step 5: tick the item in `BACKLOG.md`, mirror it in
`docs/backlog-tracker.html` (`done: true`), re-publish the artifact to the SAME
url with the Artifact tool:
```
Artifact({ file_path: "docs/backlog-tracker.html",
           url: "https://claude.ai/code/artifact/3884c9cc-b2ac-4476-b796-7b9b973782e5",
           favicon: "🐾" })
```
then commit `BACKLOG.md` + tracker to `main` and push.

## 5. Report
Commit hashes, PR number, what merged, and the updated Epic status.
