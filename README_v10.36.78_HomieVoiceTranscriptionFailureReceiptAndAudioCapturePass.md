# v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass

## Why

Homie says voice transcription failed. That means the bridge likely answered, but the Python/STT step failed or returned no transcript.

The bridge already exposes `/health`, `/doctor`, `/last-error`, and `/transcribe`; this pass makes the failure leave a better receipt and optionally saves the raw mic audio Homie sent to the bridge.

## What this changes

Touches only:

- `backend_scaffold/homie-voice-bridge.mjs`
- adds debug/test scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- Homie UI layout
- backend transcriber Python

## Adds

- `RUN_HOMIE_VOICE_BRIDGE_DEBUG_CAPTURE_v10.36.78.bat`
- `TEST_HOMIE_VOICE_TRANSCRIPTION_FAILURE_v10.36.78.ps1`
- `OPEN_HOMIE_VOICE_DEBUG_AUDIO_v10.36.78.bat`

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.78_HomieVoiceTranscriptionFailureReceiptAndAudioCapturePass.ps1
```

## Test

1. Stop the old bridge window with Ctrl+C.
2. Start debug bridge:

```powershell
cd C:\OddEngine
.\RUN_HOMIE_VOICE_BRIDGE_DEBUG_CAPTURE_v10.36.78.bat
```

3. In Homie:
   - Use local bridge + check
   - Probe 8765
   - Bridge say test
   - Say a full sentence
   - Stop listening

4. Run:

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\TEST_HOMIE_VOICE_TRANSCRIPTION_FAILURE_v10.36.78.ps1
```

5. Open raw audio folder:

```powershell
.\OPEN_HOMIE_VOICE_DEBUG_AUDIO_v10.36.78.bat
```

## What to look for

- If raw audio contains your full sentence but `/last-error` says Python/STT failed, the issue is STT deps/model/ffmpeg.
- If raw audio only contains one word or a clipped phrase, the issue is browser recording timing/capture.
- If raw audio is silent/too quiet, the issue is mic input selection or gain.
