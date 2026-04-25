# v10.36.66b_HomieBuddyCameraPreviewInstallerSyntaxHotfixPass

Fixes the installer crash from v10.36.66.

## Why

The v10.36.66 apply script crashed before modifying source because the patch-generator script contained a nested JavaScript template string. Your log showed:

- `SyntaxError: Unexpected identifier '$'`
- checker missing `v10.36.66 checker-safe marker`
- typecheck/build still passed because the app source was unchanged

## Scope

Touches only:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/homieRebuild.css`
- pass scripts

Does not touch:

- Trading
- CardGODMode
- Writers Lounge
- backend
- layout system

## Run from C:\OddEngine

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.66b_HomieBuddyCameraPreviewInstallerSyntaxHotfixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.66b_HomieBuddyCameraPreviewInstallerSyntaxHotfixPass.ps1

cd ui
npm run typecheck
npm run build
npm run dev
```

## Test

1. Open Homie.
2. Confirm the small launcher disappears while the full Homie house is open.
3. Scroll to Voice.
4. Click `Start camera`.
5. Confirm live preview appears.
6. Confirm signal text updates.
7. Click `Stop camera`.
8. Hide Homie and confirm launcher returns.