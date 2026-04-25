# v10.36.86_HomieNeuralLocalVoiceBridgeAndEmotionBlendPass

## Why

You asked for:
- `v10.36.86_HomieNeuralLocalVoiceBridgeAndEmotionBlendPass`
- and to start designing an AI clone of yourself

This pass starts that design honestly.

## What this pass does

Touches only:
- `backend_scaffold/homie-neural-voice-bridge.mjs`
- `backend_scaffold/homie_clone_profile.v1.json`
- root runner/test/readme files
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge
- layout system
- existing voice bridge
- existing launcher

## What you get

- a separate **neural voice bridge** on `127.0.0.1:8776`
- a **clone profile JSON** you can edit to make Homie feel more like you
- emotion detection:
  - warm
  - focused
  - bright
  - concerned
- cadence blending:
  - rate
  - pitch
  - pause pacing
- gesture suggestion:
  - wave
  - wink
  - nod
  - tilt
  - spark
- `/preview` endpoint to see how the text gets shaped
- `/speak` endpoint that can proxy to your own neural TTS provider if configured

## Honest status

This is the design-start pass, not a fake “full clone is done” pass.

Without `HOMIE_NEURAL_TTS_ENDPOINT`, the bridge gives:
- clone profile shaping
- emotion/cadence blending
- request receipts

With `HOMIE_NEURAL_TTS_ENDPOINT`, it can proxy shaped requests to your provider.

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.86_HomieNeuralLocalVoiceBridgeAndEmotionBlendPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.86_HomieNeuralLocalVoiceBridgeAndEmotionBlendPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.86_HomieNeuralLocalVoiceBridgeAndEmotionBlendPass.ps1
```

## Start the bridge

```powershell
cd C:\OddEngine
.\RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.bat
```

## Test it

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.86.ps1
```

## Next best move after this

Fill out `backend_scaffold\homie_clone_profile.v1.json` with:
- your favorite phrases
- words you never use
- your humor style
- your family priorities
- your real tone
- your “that sounds like me / that does not sound like me” notes
