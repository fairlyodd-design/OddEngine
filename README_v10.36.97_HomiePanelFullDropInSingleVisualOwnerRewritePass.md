# v10.36.97_HomiePanelFullDropInSingleVisualOwnerRewritePass

This pass fully replaces `ui/src/panels/Homie.tsx`.

## Keeps
- chat
- Ollama status
- recovery lane
- chores / family lane
- quick actions
- guide tab

## Changes
- hoodie companion becomes the only default visual owner of the AI tab
- old purple stage moves into a small collapsed Legacy preview
- no Trading/CardGODMode/layout changes

## Run

```powershell
cd C:\OddEngine

Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.97_HomiePanelFullDropInSingleVisualOwnerRewritePass.zip" C:\OddEngine

powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.97_HomiePanelFullDropInSingleVisualOwnerRewritePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.97_HomiePanelFullDropInSingleVisualOwnerRewritePass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```