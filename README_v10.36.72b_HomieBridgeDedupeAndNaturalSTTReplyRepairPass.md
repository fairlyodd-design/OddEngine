# v10.36.72b_HomieBridgeDedupeAndNaturalSTTReplyRepairPass

## Why

Your current state has two issues:

1. TypeScript fails because v10.36.70 and v10.36.70b both installed the same direct bridge helper functions:
   - `normalizeHomieBridgeBaseUrl`
   - `isDesktopBridgeUnavailable`
   - `homieBridgeFetchJson`
   - `callHomieVoiceBridgeProbe`
   - `callHomieVoiceBridgeTranscribe`

2. Homie now hears audio, but short / messy STT phrases trigger a repetitive boilerplate reply.

## What this pass does

- Removes the older duplicate v10.36.70 bridge helper block and keeps the v10.36.70b visible local bridge controls.
- Verifies only one copy of every bridge helper function remains.
- Rewrites Homie companion replies so:
  - `Thanks` → short natural response
  - `Now` → short acknowledgement
  - messy STT like `Going to this here we now` → asks for correction instead of pretending
  - no more repeated “Useful read: keep Homie as informational...” essay
- Adds `RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat` using `HOMIE_WHISPER_MODEL=base.en`

## Scope

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/lib/homieCompanionCoach.ts`
- `ui/src/components/homieRebuild.css`
- adds `RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat`
- pass scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- backend
- layout system

## Run from `C:\OddEngine`

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.72b_HomieBridgeDedupeAndNaturalSTTReplyRepairPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.72b_HomieBridgeDedupeAndNaturalSTTReplyRepairPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Better accuracy test

1. Stop the old voice bridge window with `Ctrl+C`.
2. Run:
   ```powershell
   cd C:\OddEngine
   .\RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat
   ```
3. Keep that open.
4. In Homie:
   - Use local bridge
   - Bridge say test
5. Say a full sentence:
   `Homie open Render Lab and tell me the next step.`
6. If it hears wrong, say:
   `correction: Homie open Render Lab and tell me the next step.`