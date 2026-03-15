# Release Log

## v10.25.29 — Mainline Truth and Ship Pass

This pass is a **ship / trust / documentation lock**.

### Purpose
Get the repo-facing truth back in line with the accepted local build direction so `main` can become trustworthy again.

### Included
- clean `README.md`
- synced `.oddengine_last_ui_version.txt`
- synced `ui/src/lib/version.ts`
- refreshed `BUILD_NOTES.txt`
- refreshed `docs/current-state.md`
- new `docs/V10.25.29_MAINLINE_TRUTH_AND_SHIP_PASS.md`
- new `docs/SHIP_CHECKLIST.md`

### Not included
- no broad shell rewrite
- no panel surgery
- no design drift
- no new subsystem additions

### Ship target
- commit and push on `recovery/render-worker-bridge-pass`
- merge into `main`
- refresh `checkpoint/recovery-ui-stable` after validation
