# v10.36.69_HomieBuddyMicDevicePickerAndSelectedInputProofPass

## Why

The latest video showed:

- Homie camera preview works.
- Mic permission is granted.
- Last transcript is blank.
- Mic proof meter stays at 0% peak.
- The screen recording itself has audio, so the PC can hear you, but the app/browser mic lane is likely using the wrong input device or Web Speech is using a different default mic.

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

Requires:

- v10.36.68 applied first

## Run from `C:\OddEngine`

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.69_HomieBuddyMicDevicePickerAndSelectedInputProofPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.69_HomieBuddyMicDevicePickerAndSelectedInputProofPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Open Homie.
2. Go to Voice.
3. Click `Refresh mics`.
4. Pick the microphone that matches your real input.
5. Click `Test selected mic` and talk for five seconds.
6. If the meter moves, the selected mic works.
7. Click `Say test`.
8. If meter moves but Last transcript stays blank, set that mic as Windows default or use the local bridge lane.
9. If meter stays 0%, pick another mic or fix Windows/browser input settings.