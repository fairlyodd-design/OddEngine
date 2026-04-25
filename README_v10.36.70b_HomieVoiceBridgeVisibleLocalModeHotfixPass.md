# v10.36.70b_HomieVoiceBridgeVisibleLocalModeHotfixPass

## Why

Your voice bridge is healthy on `127.0.0.1:8765`, but Homie still shows:

- `Voice engine: SpeechRecognition • Cloud voice`
- `Bridge: disabled`

That means Homie is still saved in cloud mode, or the local bridge controls are buried/not active in the visible UI.

## What this hotfix does

- Adds a visible `Use bridge` button in the main Voice button row
- Adds visible `Use local bridge`, `Probe 8765`, and `Cloud mode` controls directly inside the Voice meta card
- Sets `homieVoiceEngineMode` to `external-http`
- Directly fetches `http://127.0.0.1:8765/health` from browser mode
- Directly posts audio to `http://127.0.0.1:8765/transcribe` from browser mode
- Removes the old desktop-only local transcription dead-end

## Scope

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- backend
- layout system

## Run from `C:\OddEngine`

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.70b_HomieVoiceBridgeVisibleLocalModeHotfixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.70b_HomieVoiceBridgeVisibleLocalModeHotfixPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Keep `RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat` open.
2. Open Homie.
3. Go to Voice.
4. Click `Use bridge` or `Use local bridge`.
5. It should change toward `Local bridge` / `ready`.
6. Click `Probe 8765`.
7. Then use `Start listening` or `Hold to talk`.