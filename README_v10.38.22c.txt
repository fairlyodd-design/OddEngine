v10.38.22c_HomieAvatarStageSourceTraceAndHardReplacePass

Purpose:
- Trace the actual Homie avatar source winner.
- Neutralize old v10.38.18/19/20/22 anime/composite PNG layers.
- Force main Homie + HomieBuddy visual lead to the procedural 3D canvas wrapper.
- Keep GLB prototype files, routines, receipts, legacy sync, voice, backend, Trading, CardGODMode, and shell untouched.

Install:
1) Extract this ZIP into C:\OddEngine so APPLY_v10.38.22c.bat sits in C:\OddEngine.
2) Double-click APPLY_v10.38.22c.bat.

Alternative:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\APPLY_v10.38.22c_HomieAvatarStageSourceTraceAndHardReplace.ps1 -RepoRoot C:\OddEngine

Validation run by script:
npm --prefix ui run typecheck
npm --prefix ui run build

After green validation:
git add ui/src/components/HomieTrue3DAvatar.tsx ui/src/components/homieTrue3DStageHardReplace.css ui/src/components/HomieBuddy.tsx ui/src/components/homieRebuild.css docs/v10.38.22c_HomieAvatarStageSourceTrace.md ui/src/lib/version.ts
git commit -m "v10.38.22c Homie avatar stage source trace and hard replace"
git tag v10.38.22c-clean
git push origin main --tags

Acceptance:
- No homie-composite-hoodie-avatar visible.
- No homie-fullbody-hoodie-jeans visible.
- homieHumanStage::before and homieRebuildStage::before cannot paint an avatar layer.
- [data-homie-true-3d="v10.38.22c"] is the visible lead avatar source.
- Procedural canvas is isolated inside .homie3DHardStage.
