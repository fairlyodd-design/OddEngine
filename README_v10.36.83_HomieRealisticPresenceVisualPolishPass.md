# v10.36.83_HomieRealisticPresenceVisualPolishPass

## Why

You asked for a more realistic vibe and visual look for Homie.

## What this pass does

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
- launcher

## Visual improvements

- richer canvas fallback character
- premium glass panel / pod framing
- stronger head shading and face highlight
- more expressive eyes, brows, mouth, cheeks
- better chest core glow
- more alive aura / ambient motes
- smoother pointer-follow look
- calmer, more premium full-body presence

This pass is especially useful on desktop/Electron because the canvas avatar path stays available even if WebGL/Rive fails.

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.83_HomieRealisticPresenceVisualPolishPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.83_HomieRealisticPresenceVisualPolishPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.83_HomieRealisticPresenceVisualPolishPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```