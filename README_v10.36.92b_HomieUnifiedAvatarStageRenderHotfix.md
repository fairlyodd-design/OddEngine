# v10.36.92b_HomieUnifiedAvatarStageRenderHotfix

This hotfix fixes the blank stage inside the v10.36.92 unified companion preview.

## What it fixes

- gives the unified preview an explicit stage with real height
- forces the avatar wrapper/clip/canvas to size correctly
- keeps the memoji-inspired avatar lane visible in the preview card
- adds a clear visual fallback shell if the avatar is still loading

## Touches only

- `ui/src/components/HomieUnifiedAvatar.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

## Run

```powershell
cd C:\OddEngine

Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.92b_HomieUnifiedAvatarStageRenderHotfix.zip" C:\OddEngine

powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.92b_HomieUnifiedAvatarStageRenderHotfix.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.92b_HomieUnifiedAvatarStageRenderHotfix.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```