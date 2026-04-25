# v10.36.67_HomieBuddyMicRealityAndCompanionToneRetunePass

## What this fixes

From testing after v10.36.66b:

- Camera preview works, but it must be clear that camera is visual only.
- Homie can speak, but mic input needs a better transcript-proof flow.
- Homie tone was too much "caregiver / you're sick" and not enough "informational family companion / OS buddy."

## Scope

Touches only:

- `ui/src/components/HomieBuddy.tsx`
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
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.67_HomieBuddyMicRealityAndCompanionToneRetunePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.67_HomieBuddyMicRealityAndCompanionToneRetunePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Open Homie.
2. Scroll to Voice.
3. Click `Mic permission`; this only proves permission.
4. Click `Say test`.
5. Say: `Homie can hear me`.
6. Confirm `Last transcript` fills in.
7. Click `Start camera`; confirm the text says camera is visual only.
8. Ask/type: `I can hear you but you cannot hear me on mic or camera`.
9. Homie should explain speaker/mic/camera lanes clearly instead of giving a sick/therapy-style response.