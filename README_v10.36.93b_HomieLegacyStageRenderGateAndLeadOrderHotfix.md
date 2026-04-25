# v10.36.93b_HomieLegacyStageRenderGateAndLeadOrderHotfix

## Why

This hotfix addresses the real remaining issue:
the legacy purple stage is still rendering too high in the Homie panel even though startup, bridge, and avatar rendering are already fine.

## What this pass does

Touches only:
- `ui/src/panels/Homie.tsx`
- pass scripts

It:
- renders the unified companion lead card first
- hides the old Full body avatar / Web fallback stage by default
- adds a small Legacy preview disclosure
- uses a stronger panel-level gate for the old stage

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.93b_HomieLegacyStageRenderGateAndLeadOrderHotfix.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.93b_HomieLegacyStageRenderGateAndLeadOrderHotfix.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.93b_HomieLegacyStageRenderGateAndLeadOrderHotfix.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```