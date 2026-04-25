# v10.36.99_HomieLeadAvatarHeroParityAndRightLaneMatchPass

This is a clean full drop-in replacement for `ui/src/panels/Homie.tsx`.

## Why
The previous 98 pass did not land cleanly in your local file. This pass resets the panel to a known-good full file and applies the requested hero-parity polish.

## Scope
- make the top lead avatar match the right-side companion more closely
- tighten head shape
- tighten eye spacing
- refine mouth shape
- refine arm/hand proportion
- refine body taper
- refine inner frame spacing
- soften aura
- keep the current single-owner layout
- keep Legacy preview collapsed
- touch Homie visual lane only

## Run

```powershell
cd C:\OddEngine

Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.99_HomieLeadAvatarHeroParityAndRightLaneMatchPass.zip" C:\OddEngine

powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.99_HomieLeadAvatarHeroParityAndRightLaneMatchPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.99_HomieLeadAvatarHeroParityAndRightLaneMatchPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```