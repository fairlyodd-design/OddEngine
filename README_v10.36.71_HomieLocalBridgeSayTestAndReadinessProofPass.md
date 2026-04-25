# v10.36.71_HomieLocalBridgeSayTestAndReadinessProofPass

## Why

After v10.36.70b, Homie shows:

- Bridge on
- Voice engine: Local bridge
- Mic level 99% peak

That means the mic is sending audio. The remaining issue is that the old `Say test` path still tests browser `SpeechRecognition`, not local bridge STT.

## What this pass does

- Adds a `Local bridge proof` card
- Adds direct `/health` proof
- Adds direct `/doctor` proof
- Adds `Bridge say test`
- Routes the visible Say test to `Bridge say test` when Homie is in local bridge mode
- Updates the proof text when the local bridge returns an actual transcript
- Makes the UI explain that browser Say test and bridge Say test are different

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
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.71_HomieLocalBridgeSayTestAndReadinessProofPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.71_HomieLocalBridgeSayTestAndReadinessProofPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Keep `RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat` open.
2. Open Homie.
3. Voice → Use local bridge.
4. Click `Check health`.
5. Click `Run doctor`.
6. Click `Bridge say test`.
7. Say one short sentence and wait. First Whisper run can take longer.
8. Expected: `Bridge transcript captured: ...`