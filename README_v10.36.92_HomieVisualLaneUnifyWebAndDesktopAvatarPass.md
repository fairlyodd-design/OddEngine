# v10.36.92_HomieVisualLaneUnifyWebAndDesktopAvatarPass

## Why

This pass makes the hoodie/beard/glasses companion become the lead visual lane inside Homie, so web and desktop feel more aligned.

## What this pass does

Touches only:
- `ui/src/components/HomieUnifiedAvatar.tsx`
- `ui/src/panels/Homie.tsx`
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge internals
- layout system
- voice bridge
- launcher

## Result

Inside Homie:
- a new **Unified companion preview** card is added near the top
- it uses the same memoji-inspired desktop-safe avatar lane
- the older stage is visually de-emphasized
- web and desktop stop feeling like two completely different characters

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.92_HomieVisualLaneUnifyWebAndDesktopAvatarPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.92_HomieVisualLaneUnifyWebAndDesktopAvatarPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.92_HomieVisualLaneUnifyWebAndDesktopAvatarPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```