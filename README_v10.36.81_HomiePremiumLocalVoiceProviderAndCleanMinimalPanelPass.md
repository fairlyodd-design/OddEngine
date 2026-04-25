# v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass

## Why

You wanted:
- more visual and vocal personality for Homie
- a cleaner minimal Homie panel
- one launcher that starts FairlyOdd OS and Homie together
- an EXE path for that launcher

## What this pass does

Touches only:
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/RiveHomie.tsx`
- `ui/src/components/homieRebuild.css`
- root launcher/build-exe files
- pass scripts

## Personality upgrades
- warmer browser-local TTS shaping
- more personal presence lines
- smoother pointer tracking
- warmer, softer speaking pulse
- richer aura motion
- bigger stage personality

## Cleaner panel
- hides memory grid filler
- hides footer filler
- tightens diagnostics and voice sections
- keeps the panel more stage-first and useful

## One-click launch
Adds:
- `RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat`
- `BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.ps1`

The BAT launches:
- render backend
- music bridge
- Homie voice bridge
- FairlyOdd desktop UI

The PowerShell builder uses Windows built-in **IExpress** to generate a real launcher EXE on your PC.

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.81_HomiePremiumLocalVoiceProviderAndCleanMinimalPanelPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## One-click launcher
```powershell
cd C:\OddEngine
.\RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat
```

## Build the EXE on Windows
```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.81.ps1
```

That will create:
`C:\OddEngine\FairlyOdd_OS_and_Homie_v10.36.81.exe`