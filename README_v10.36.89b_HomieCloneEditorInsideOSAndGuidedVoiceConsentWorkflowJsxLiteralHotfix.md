# v10.36.89b_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowJsxLiteralHotfix

Hotfix for the v10.36.89 panel parse/build failure.

## What it fixes

In `ui/src/panels/HomieCloneStudio.tsx`, the inline example:

`Format: [{"text":"Keep the room calm.","lane":"family","notes":"core tone"}]`

was written directly into JSX, so the braces were parsed as JSX expression syntax.

This hotfix converts that example into a safe code literal.

## Touches only

- `ui/src/panels/HomieCloneStudio.tsx`
- pass scripts

## Run

```powershell
cd C:\OddEngine

Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.89b_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowJsxLiteralHotfix.zip" C:\OddEngine

powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.89b_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowJsxLiteralHotfix.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.89b_HomieCloneEditorInsideOSAndGuidedVoiceConsentWorkflowJsxLiteralHotfix.ps1

cd ui
npm run typecheck
npm run build
```