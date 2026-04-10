# v10.26.15d — True Synthetic Companion Relationship Layer Pass

## What landed

This pass turns detached Homie into a more embodied companion lane instead of just a floating reply box.

### Live conversation lane in detached Homie
- added a face-to-face lane inside the detached companion
- saved preferred mic input
- saved preferred camera input
- saved preferred speaker voice for speech synthesis
- optional live camera preview with mirror toggle

### Relationship continuity layer
- expanded relationship memory with:
  - bond line
  - continuity line
  - user mood
  - companion tone
- folded those lines into the Homie system prompt and live memory context
- surfaced the new continuity cues inside the full Homie panel

### Homie panel additions
- new face-to-face companion settings lane
- camera conversation toggle
- preview mirror toggle
- preferred mic / camera / speaker voice selectors
- live preview box when camera mode is enabled

## Important truth
- speaker output still follows the system default audio device in this build
- the saved speaker preference controls the voice selection, not OS-level output routing
- the camera preview is presence-only in this pass
- Homie should not claim it visually understood anything unless a real image/video analysis path is added later

## Files touched
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/lib/homieCompanion.ts`
- `ui/src/lib/homieMemory.ts`
- `ui/src/lib/prefs.ts`
- `ui/src/lib/version.ts`
- `.oddengine_last_ui_version.txt`
- `docs/TRUE_SYNTHETIC_COMPANION_RELATIONSHIP_LAYER_PASS.md`

## Validation
- source-level TypeScript syntax/transpile checks passed for all touched files
- this is still not a full dependency-installed production build check
