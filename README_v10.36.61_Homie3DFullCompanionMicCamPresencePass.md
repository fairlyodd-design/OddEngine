# v10.36.61_Homie3DFullCompanionMicCamPresencePass

Target: Homie panel only.

This pass adds a first real full-presence companion shell:

- 3D animated Homie avatar using existing `three` / `@react-three/fiber` dependencies
- opt-in mic lane
- browser SpeechRecognition when available
- safe mic permission fallback when SpeechRecognition is unavailable
- opt-in camera lane
- local camera brightness + rough movement signal
- camera truth guard: Homie must not pretend to identify people, objects, faces, text, or private details
- local speech output using browser speechSynthesis
- Desktop/Ollama handoff through existing `oddApi().homieChat`
- web-safe fallback replies if Desktop/Ollama are unavailable
- privacy off button that stops mic, camera, and speech

Important honesty note:
This is not semantic computer vision yet. The camera interaction is deliberately limited to brightness and motion signals so Homie does not fake what it can see.

Scope:

- touches `ui/src/panels/Homie.tsx`
- adds `ui/src/components/Homie3DCompanion.tsx`
- does not touch Trading
- does not touch CardGODMode
- does not rewrite layout system

Apply from the workshop repo, not the stable runner:

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.61_Homie3DFullCompanionMicCamPresencePass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.61_Homie3DFullCompanionMicCamPresencePass.ps1
cd ui
npm run typecheck
npm run build
```

If clean, commit/tag from `C:\OddEngine`, then update `C:\OddEngine_STABLE` to the new clean tag.
