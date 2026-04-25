# v10.36.65_HomieBuddyHouseUXPolishAndLauncherCleanupPass

CSS-only Homie Buddy house polish pass.

## Scope

Touches only:

- `ui/src/components/homieRebuild.css`

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- backend
- layout system
- Homie brain/voice/camera logic

## What it does

- hides the tiny launcher while the full Homie house is open
- gives the open house cleaner panel sizing
- improves internal scrolling
- makes the avatar stage feel more intentional
- tightens Talk / Family Mode / Legacy Tools / Voice spacing
- preserves mic/cam opt-in behavior and legacy tools

## Run from `C:\OddEngine`

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.65_HomieBuddyHouseUXPolishAndLauncherCleanupPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.65_HomieBuddyHouseUXPolishAndLauncherCleanupPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```