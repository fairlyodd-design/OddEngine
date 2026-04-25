# v10.36.95_HomieAiTabDirectRewriteSingleVisualLanePass

## Why

Your local Homie.tsx drifted enough that anchor-based insertions stopped being trustworthy.
This pass directly rewrites the AI tab render section instead.

## What this pass does

Touches only:
- `ui/src/panels/Homie.tsx`
- pass scripts

It:
- directly rewrites the Homie AI tab render section
- makes the unified companion the only default lead stage
- moves the old purple stage into a true legacy preview lower down
- removes prior experimental injected lead blocks inside the AI tab
- stops relying on post-render hiding

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.95_HomieAiTabDirectRewriteSingleVisualLanePass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.95_HomieAiTabDirectRewriteSingleVisualLanePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.95_HomieAiTabDirectRewriteSingleVisualLanePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```