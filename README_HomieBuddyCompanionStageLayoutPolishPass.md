# v10.36.64 Homie Buddy Companion Stage Layout Polish Pass

Purpose: keep the full-body Homie from v10.36.63, but make the stage feel cleaner and more premium.

What it changes:
- CSS-only follow-up for the floating/right-rail Homie Buddy
- gives the avatar a reserved display stage instead of overlapping text/cards
- refines scale, z-index, spacing, glow, and launcher size
- keeps mic/cam/voice/privacy behavior untouched

Scope:
- ui/src/components/homieRebuild.css only
- no Trading
- no CardGODMode
- no Writers Lounge
- no backend
- no layout system rewrite

Run from repo root:

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_HomieBuddyCompanionStageLayoutPolishPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_HomieBuddyCompanionStageLayoutPolishPass.ps1
cd ui
npm run typecheck
npm run build
npm run dev
```
