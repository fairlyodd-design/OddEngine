# v10.36.61b Homie 3D Companion Apply + Typecheck Hotfix Pass

This hotfix repairs the v10.36.61 pass when:

- `Homie.tsx` import injection failed because the apply script expected one exact LF-only React import line.
- `Homie3DCompanion.tsx` failed `npm run typecheck` with `drawImage/getImageData` on `RenderingContext`.

## Scope

Touches only:

- `ui/src/panels/Homie.tsx`
- `ui/src/components/Homie3DCompanion.tsx`
- helper scripts

Does not touch Trading, CardGODMode, Writers Lounge, or layout systems.

## Run from C:\OddEngine

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.61b_Homie3DCompanionApplyAndTypecheckHotfixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.61b_Homie3DCompanionApplyAndTypecheckHotfixPass.ps1
cd ui
npm run typecheck
npm run build
npm run dev
```

## Notes

This overwrites the Homie 3D companion component with a type-safe canvas context cast and adds a CRLF-safe Homie panel import/block injector.
