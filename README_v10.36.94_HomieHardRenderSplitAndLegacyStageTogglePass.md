# v10.36.94_HomieHardRenderSplitAndLegacyStageTogglePass

## Why

This pass stops relying on soft post-render hiding and instead fixes the Homie visual priority at the render-tree level.

## What this pass does

Touches only:
- `ui/src/panels/Homie.tsx`
- pass scripts

It:
- renders the unified companion lead card first
- hard-gates the old Full body avatar / Web fallback stage with:
  - `showLegacyAvatar ? (...) : null`
- puts the legacy stage behind a small Legacy preview toggle
- removes prior experimental injected lead blocks so there is one clear lead lane

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.94_HomieHardRenderSplitAndLegacyStageTogglePass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.94_HomieHardRenderSplitAndLegacyStageTogglePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.94_HomieHardRenderSplitAndLegacyStageTogglePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```