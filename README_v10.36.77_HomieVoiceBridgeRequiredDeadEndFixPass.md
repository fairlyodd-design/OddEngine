# v10.36.77_HomieVoiceBridgeRequiredDeadEndFixPass

## Why

Homie is stuck saying "voice bridge required" even though Local bridge is selected.

## What this fixes

- Direct browser probe to `GET http://127.0.0.1:8765/health`
- Direct browser transcribe to `POST http://127.0.0.1:8765/transcribe`
- Removes the old desktop-only transcribe dead-end
- Replaces vague "voice bridge required" with clear bridge-not-reachable guidance
- Adds `Use local bridge + check`
- Adds `Probe 8765`
- Adds `TEST_HOMIE_VOICE_BRIDGE_v10.36.77.ps1`

## Scope

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

No Trading, CardGODMode, Writers Lounge, backend, or layout changes.

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.77_HomieVoiceBridgeRequiredDeadEndFixPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.77_HomieVoiceBridgeRequiredDeadEndFixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.77_HomieVoiceBridgeRequiredDeadEndFixPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Bridge test

In a separate PowerShell, start the bridge and keep it open:

```powershell
cd C:\OddEngine
.\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat
```

If that file is not present:

```powershell
.\RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat
```

Then test:

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\TEST_HOMIE_VOICE_BRIDGE_v10.36.77.ps1
```
