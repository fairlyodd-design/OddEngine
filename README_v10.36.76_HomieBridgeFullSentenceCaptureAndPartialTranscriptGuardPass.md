# v10.36.76_HomieBridgeFullSentenceCaptureAndPartialTranscriptGuardPass

## Why

Homie can hear audio, but a full sentence can come back as one word. That usually means the local bridge recording was clipped, too short, too quiet, or stopped before the final words made it into the audio blob.

## What this pass does

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- pass scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- backend transcriber
- layout system

## Fixes

- raises local bridge minimum recording from ~0.7s to 3.6s
- raises minimum audio blob size
- records one full blob instead of 250ms fragments
- adds post-roll after clicking Stop listening so last words are not clipped
- adds a guard: if the bridge only catches one word from a full clip, Homie does not pretend it understood
- improves voice status text: speak one full sentence, pause, then stop

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.76_HomieBridgeFullSentenceCaptureAndPartialTranscriptGuardPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.76_HomieBridgeFullSentenceCaptureAndPartialTranscriptGuardPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.76_HomieBridgeFullSentenceCaptureAndPartialTranscriptGuardPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

Keep your audio-cleanup bridge running, then in Homie:

1. Click `Bridge say test`.
2. Wait half a second.
3. Say one clear full sentence: `Homie open Render Lab and tell me the next step.`
4. Wait half a second.
5. Click `Stop listening`.
6. Wait for the bridge transcript.

The goal is to stop the one-word transcript bug and make Homie tell you when the clip was partial instead of acting like it understood.
