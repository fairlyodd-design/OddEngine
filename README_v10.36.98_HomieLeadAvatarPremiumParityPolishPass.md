# v10.36.98_HomieLeadAvatarPremiumParityPolishPass

Polish pass on top of the 97 / 97b visual ownership fixes.

## Scope
- refine the top lead avatar to better match the right-side companion
- improve face proportion
- improve eye placement
- improve body silhouette
- soften glow
- improve stage framing
- keep the 97 / 97b layout structure
- keep Legacy preview collapsed
- touch Homie visual lane only

## Run

```powershell
cd C:\OddEngine

Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.98_HomieLeadAvatarPremiumParityPolishPass.zip" C:\OddEngine

powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.98_HomieLeadAvatarPremiumParityPolishPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.98_HomieLeadAvatarPremiumParityPolishPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```