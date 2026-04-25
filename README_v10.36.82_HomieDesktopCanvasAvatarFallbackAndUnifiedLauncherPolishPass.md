# v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass

## Why

Desktop OddEngine needs a true non-WebGL avatar path for Homie.
The current Rive lane uses `@rive-app/react-webgl2`, so Electron machines that fail WebGL can crash the Homie card. The web build can still work, which matches your screenshots/video. fileciteturn61file0 fileciteturn62file0

## What this pass does

Touches only:
- `ui/src/components/RiveHomie.tsx`
- `ui/src/components/homieRebuild.css`
- launcher/exe helper files
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge
- backend
- voice bridge
- layout system

## Main fix

- adds a true desktop-safe **Canvas avatar fallback** inside `RiveHomie.tsx`
- if WebGL is unavailable, Homie renders a 2D canvas avatar instead of crashing
- if the `.riv` file is missing, Homie still shows the canvas avatar
- if Rive crashes at runtime, Homie still shows the canvas avatar
- keeps pointer tracking, speaking/listening pulse, and mood glow in the canvas lane

## Launcher polish

Adds:
- `RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.82.bat`
- `BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.82.ps1`

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.82_HomieDesktopCanvasAvatarFallbackAndUnifiedLauncherPolishPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## One-click launcher

```powershell
cd C:\OddEngine
.\RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.82.bat
```

## Build the EXE on Windows

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\BUILD_FAIRLYODD_OS_AND_HOMIE_EXE_v10.36.82.ps1
```

That will create:
`C:\OddEngine\FairlyOdd_OS_and_Homie_v10.36.82.exe`