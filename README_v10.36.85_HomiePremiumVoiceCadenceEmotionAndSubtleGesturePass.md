# v10.36.85_HomiePremiumVoiceCadenceEmotionAndSubtleGesturePass

## Why

You asked for the next polish step:
- premium voice cadence
- more emotional warmth in speech
- subtle gestures in the avatar/presence lane

## What this pass does

Touches only:
- `ui/src/components/HomieBuddy.tsx`
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

## Voice upgrades

- warmer voice preference ranking
- speech emotion detection from reply text
- calmer cadence by default
- concern/focus/bright tone shaping
- cleaner spoken phrasing before browser TTS speaks it

## Gesture / presence upgrades

- wave hand motion
- wink behavior
- nod motion
- subtle tilt motion
- spark aura enhancement
- keeps premium idle presence and micro-expressions

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.85_HomiePremiumVoiceCadenceEmotionAndSubtleGesturePass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.85_HomiePremiumVoiceCadenceEmotionAndSubtleGesturePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.85_HomiePremiumVoiceCadenceEmotionAndSubtleGesturePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```