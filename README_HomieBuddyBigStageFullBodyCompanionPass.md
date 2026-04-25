# v10.36.63 HomieBuddyBigStageFullBodyCompanionPass

Purpose: replace the tiny Homie orb/mascot look in the always-available Homie Buddy rail with a larger full-body companion stage.

This pass targets the actual floating/right-rail Homie Buddy component, not just the Homie panel.

## Touches
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/homieRebuild.css`

## Does not touch
- Trading
- CardGODMode
- Writers Lounge
- layout system
- backend pipeline

## Run
```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_HomieBuddyBigStageFullBodyCompanionPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_HomieBuddyBigStageFullBodyCompanionPass.ps1
cd ui
npm run typecheck
npm run build
npm run dev
```

## Notes
This is visual/presence polish for the existing Homie Buddy shell. It keeps the existing mic/voice/camera opt-in behavior and the legacy/family memory flow.
