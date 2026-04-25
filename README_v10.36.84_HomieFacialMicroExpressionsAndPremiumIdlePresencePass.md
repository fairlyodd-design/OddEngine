# v10.36.84_HomieFacialMicroExpressionsAndPremiumIdlePresencePass

## Why

You asked for the next realism step: facial micro-expressions and a more premium idle presence.

## What this pass does

Touches only:
- `ui/src/components/RiveHomie.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge
- backend
- voice bridge
- launcher

## Visual upgrades

- subtler idle breathing + body sway
- eye saccades layered with pointer-follow
- more natural blink rhythm
- listening brow lift / warn brow tension
- softer idle smile and better speaking mouth shape
- more polished pod / glass framing
- richer ambient aura and motes
- calmer premium desktop canvas presence

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.84_HomieFacialMicroExpressionsAndPremiumIdlePresencePass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.84_HomieFacialMicroExpressionsAndPremiumIdlePresencePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.84_HomieFacialMicroExpressionsAndPremiumIdlePresencePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```