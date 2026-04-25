# v10.36.79_HomieLifelikePresenceAndWarmVoicePolishPass

## Why

Now that Homie can hear you correctly again, the next best move is to make Homie feel more alive without touching Trading, CardGODMode, Writers, or the broader layout system.

## What this pass does

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/RiveHomie.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

### Visual polish
- larger stage presence
- deeper aura and glow
- softer speaking/listening aura animation
- smoother pointer tracking for the Rive avatar
- less robotic talk pulse

### Vocal polish
- warmer voice selection preference
- cleaner spoken-text trimming
- more human presence lines
- calmer, less robotic phrasing

## Important note

This improves the **feel** of browser speech synthesis and the current avatar lane.

A truly lifelike **voice quality** beyond browser TTS will still need a later local/provider TTS pass.

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.79_HomieLifelikePresenceAndWarmVoicePolishPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.79_HomieLifelikePresenceAndWarmVoicePolishPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.79_HomieLifelikePresenceAndWarmVoicePolishPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

- open Homie
- watch idle aura, listening aura, and speaking aura
- move your pointer around the screen and watch the smoother look motion
- ask Homie a few short and long questions
- compare the spoken phrasing and warmth against the previous build