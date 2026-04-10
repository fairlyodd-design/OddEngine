# v10.26.14q Detached Homie Electron Fallback Hotfix Pass

## What changed
- made desktop detection more defensive by recognizing Electron/file protocol even when preload is not exposed
- added browser/electron fallback window openers in `ui/src/lib/odd.ts`
- auto-launch now uses the fallback-capable path in `ui/src/App.tsx`
- inline Homie bubble now stays hidden whenever detached mode is active in an Electron shell

## Why
Some merged builds were running inside Electron but not exposing `window.__ODD__` cleanly at boot. That made the UI think it was not on desktop, so the detached Homie path never fired and the inline buddy kept rendering inside the main shell.
