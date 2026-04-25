# v10.36.97b_HomieUnifiedLeadAvatarMountParityHotfix

Hotfix on top of v10.36.97.

## Scope
- make the top Unified companion lead card render the same working avatar lane style as the right-side companion
- preserve the new single-owner layout from 97
- keep Legacy preview collapsed
- touch Homie visual lane only

## Run

```powershell
cd C:\OddEngine

Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.97b_HomieUnifiedLeadAvatarMountParityHotfix.zip" C:\OddEngine

powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.97b_HomieUnifiedLeadAvatarMountParityHotfix.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.97b_HomieUnifiedLeadAvatarMountParityHotfix.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```