# v10.36.66_HomieBuddyTrueCameraPreviewAndLauncherGatePass

## What this fixes from the Homie video

- The tiny launcher should not remain visible while the full Homie house is open.
- Camera should be a real opt-in preview lane, not only a permission/status check.
- Homie should stay honest: camera preview is local, no video is saved, and the only sampled signals are brightness/motion.

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
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.66_HomieBuddyTrueCameraPreviewAndLauncherGatePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.66_HomieBuddyTrueCameraPreviewAndLauncherGatePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Open Homie.
2. Confirm the small launcher disappears while the full Homie house is open.
3. Go to Voice.
4. Click `Start camera`.
5. Confirm a live preview appears.
6. Confirm signal text updates with room-light / movement changes.
7. Click `Stop camera`.
8. Hide Homie and confirm the small launcher returns.