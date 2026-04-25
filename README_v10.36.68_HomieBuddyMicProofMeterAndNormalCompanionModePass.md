# v10.36.68_HomieBuddyMicProofMeterAndNormalCompanionModePass

## Why

The latest video shows:

- Camera preview is working.
- Camera copy correctly says it is visual only.
- Mic permission is granted and audio inputs exist.
- `Last transcript` is still blank, so Homie cannot prove he actually heard words.
- The voice/mic UI needs to separate:
  - permission
  - signal/audio level
  - transcript

## Scope

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/homieRebuild.css`
- `ui/src/lib/homieCompanionCoach.ts`
- pass scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- backend
- layout system

## Run from `C:\OddEngine`

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.68_HomieBuddyMicProofMeterAndNormalCompanionModePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.68_HomieBuddyMicProofMeterAndNormalCompanionModePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Open Homie.
2. Go to Voice.
3. Click `Say test`.
4. Say clearly: `Homie can hear me`.
5. Watch the new mic meter.
6. Check:
   - if the meter moves but Last transcript stays blank, SpeechRecognition is the weak link.
   - if the meter does not move, Windows/browser input path is the issue.
   - if Last transcript fills in, Homie truly heard words.
7. Start camera; confirm it still says camera is visual only.
8. Ask: `What can you help with?`
   Homie should answer like a clear family/OS companion, not a hospital robot.