# v10.36.90_HomieCloneStudioQuickAccessAndBridgeReadinessCardPass

## Why

This is the next clean move after the in-OS Clone Studio panel:
put a direct, family-clear entry point inside **Homie** itself.

## What this pass does

Touches only:
- `ui/src/panels/Homie.tsx`
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge internals
- layout system
- mic/STT bridge
- launcher

## What you get

Inside the Homie panel AI lane:
- a new **Homie Clone Studio quick access** card
- clear bridge reminder: `127.0.0.1:8776`
- one-click:
  - Open Clone Studio
  - Ask clone guide
  - Open Writers Lounge
  - Back to current panel

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.90_HomieCloneStudioQuickAccessAndBridgeReadinessCardPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.90_HomieCloneStudioQuickAccessAndBridgeReadinessCardPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.90_HomieCloneStudioQuickAccessAndBridgeReadinessCardPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```