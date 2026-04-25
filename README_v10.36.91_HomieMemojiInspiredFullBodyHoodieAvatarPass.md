# v10.36.91_HomieMemojiInspiredFullBodyHoodieAvatarPass

## Why

This pass replaces the current fallback body with a warmer, memoji-inspired full-body Homie:
- gray hoodie
- blue jeans
- glasses
- beard
- cap
- arms / hands / legs / feet
- desktop-safe canvas fallback

## What this pass does

Touches only:
- `ui/src/components/RiveHomie.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge
- layout system
- voice bridge
- launcher

## Result

When WebGL/Rive is unavailable or unstable, Homie now renders a:
- stylized full-body avatar
- friendlier face rig
- hoodie + jeans silhouette
- idle breathing
- blink
- gaze follow
- speaking mouth
- wave / wink / nod / tilt / spark gestures

Web builds can still use the Rive path when available.
Desktop gets a stronger safe fallback path instead of a weak/placeholder look.

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.91_HomieMemojiInspiredFullBodyHoodieAvatarPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.91_HomieMemojiInspiredFullBodyHoodieAvatarPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.91_HomieMemojiInspiredFullBodyHoodieAvatarPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```