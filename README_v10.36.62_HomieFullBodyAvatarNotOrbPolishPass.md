# v10.36.62 Homie Full Body Avatar Not-Orb Polish Pass

Purpose: replace the placeholder orb-style Homie 3D avatar with a soft non-human full-body companion shell.

Adds/preserves:
- face, head, torso, arms, legs, hands, feet, wings, antenna, aura
- mic/cam opt-in controls from v10.36.61/61b
- honest camera truth layer: brightness + rough movement only
- speech recognition / speech synthesis hooks
- local Ollama handoff through the existing Homie bridge

Scope:
- `ui/src/components/Homie3DCompanion.tsx`
- `ui/src/panels/Homie.tsx` import/host marker only if needed

Does not touch:
- Trading
- CardGODMode
- Writers Lounge
- layout system

Run from `C:\OddEngine`:

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.62_HomieFullBodyAvatarNotOrbPolishPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.62_HomieFullBodyAvatarNotOrbPolishPass.ps1
cd ui
npm run typecheck
npm run build
npm run dev
```
