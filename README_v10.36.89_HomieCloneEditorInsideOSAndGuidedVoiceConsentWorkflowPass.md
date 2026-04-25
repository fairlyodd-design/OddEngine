# v10.36.89_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowPass

This is the rebuilt pass that adds the in-OS **Homie Clone Studio** panel before the quick-access card pass.

Touches only:
- `ui/src/panels/HomieCloneStudio.tsx`
- `ui/src/App.tsx`
- `ui/src/lib/brain.ts`
- pass scripts

What it adds:
- a new **Homie Clone Studio** panel inside the OS
- clone identity editor
- tone + cadence editor
- family phrases editor
- preview text runner
- bridge/training summary
- guided voice consent workflow
- routes back to Homie and Writers Lounge

Run from `C:\OddEngine`:

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.89_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.89_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.89_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```