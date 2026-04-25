# v10.36.81b_HomieDesktopWebGLFallbackHotfixPass

## Why

Desktop OddEngine is throwing:

- `Homie hit a runtime error`
- `Error creating WebGL context`

But the web build still shows the Homie fallback/avatar lane.

The current Homie avatar uses `@rive-app/react-webgl2`, so if Electron/desktop cannot create a WebGL context, the Rive lane can blow up at runtime instead of falling back gracefully. fileciteturn61file0 fileciteturn62file0

## What this fixes

Touches only:

- `ui/src/components/RiveHomie.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- backend
- voice bridge
- layout system

## Fix behavior

- preflight-checks WebGL before mounting Rive
- if desktop/Electron cannot create a WebGL context, Homie shows fallback immediately
- wraps the Rive lane in a React error boundary
- if Rive throws at runtime, it falls back instead of taking down the Homie panel
- keeps the web build behavior intact

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.81b_HomieDesktopWebGLFallbackHotfixPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.81b_HomieDesktopWebGLFallbackHotfixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.81b_HomieDesktopWebGLFallbackHotfixPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Expected result

Desktop OddEngine should stop showing the red runtime crash card for Homie.
Instead, if WebGL is not available, Homie should render the normal fallback/avatar lane with a small `Desktop fallback` badge.