# v10.36.80_HomieTrueWarmLocalTTSVoicePass

## Why

You asked for two things together:

- warmer, more lifelike local TTS feeling
- less excess and filler on the Homie panel

## What this pass does

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/RiveHomie.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

### Voice polish
- warmer browser-local voice preference
- cleaner spoken-text shaping
- calmer rate / pitch / cadence
- more natural presence copy

### Visual / panel polish
- smoother pointer tracking
- softer talk pulse
- richer aura motion
- tighter spacing
- hides the filler footer
- compacts diagnostics/voice meta so only the necessary stuff dominates

## Notes

This improves the **current browser/local TTS lane** and the current Homie stage.

A later provider/local-model TTS pass is still the move for truly premium voice realism.

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.80_HomieTrueWarmLocalTTSVoicePass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.80_HomieTrueWarmLocalTTSVoicePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.80_HomieTrueWarmLocalTTSVoicePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

- open Homie
- compare the speaking voice before vs after
- watch idle/listening/speaking aura
- move your pointer and watch smoother tracking
- confirm the panel feels cleaner and less crowded