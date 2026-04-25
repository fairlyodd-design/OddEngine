# v10.36.93_HomieLegacyStageRetireAndUnifiedCompanionLeadPass

## Why

This pass fixes the real remaining issue:
the older purple experimental stage is still visually dominant even though the unified companion lane is the right direction.

## What this pass does

Touches only:
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
- the unified hoodie companion becomes the top/default main stage
- the older purple stage is hidden by default
- a small **Legacy preview** disclosure controls whether the older stage is shown
- the old stage no longer defines the main visual impression

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.93_HomieLegacyStageRetireAndUnifiedCompanionLeadPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.93_HomieLegacyStageRetireAndUnifiedCompanionLeadPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.93_HomieLegacyStageRetireAndUnifiedCompanionLeadPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```