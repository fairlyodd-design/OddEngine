# v10.36.96_HomieAiTabFullDropInSingleCompanionRewritePass

## Why

The local `Homie.tsx` drifted too far for anchor-style visual patches to be trustworthy.
This pass directly rewrites the AI tab JSX so the right companion owns the page by default.

## What this pass does

Touches only:
- `ui/src/panels/Homie.tsx`
- pass scripts

It:
- fully rewrites the Homie AI tab visual section
- makes the hoodie companion the only top/default visual
- moves the purple stage into a small collapsed Legacy preview lower down
- preserves the rest of the Homie panel behavior
- avoids Trading/CardGODMode/layout changes

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.96_HomieAiTabFullDropInSingleCompanionRewritePass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.96_HomieAiTabFullDropInSingleCompanionRewritePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.96_HomieAiTabFullDropInSingleCompanionRewritePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```