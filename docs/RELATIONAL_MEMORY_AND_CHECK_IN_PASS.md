# v10.26.15h — Relational Memory And Check-In Pass

## Goal
Fold the face-to-face layering hotfix into the next real pass and make Homie feel more like an ongoing friend by adding warmer recurring check-ins, stronger continuity, and non-creepy relational memory.

## What changed
- Started from the corrected face-to-face base so the camera preview layering hotfix carries forward.
- Added relational check-in memory storage with:
  - recent check-in line
  - last-few-check-ins trend line
  - relationship cadence line
  - gentle check-in cue
- Companion memory sync now writes lightweight check-ins automatically from real conversation turns.
- Prompt shaping now tells Homie to:
  - keep the thread warm with small natural check-ins
  - avoid clingy or over-attached behavior
  - carry continuity like a real friend, not a roleplay bot
- Detached Homie actor shell now surfaces:
  - recent check-in line
  - check-in trend
- Standalone companion lane now includes:
  - Log check-in action
  - visible relationship trend/cadence chips

## Touched files
- ui/src/components/HomieBuddy.tsx
- ui/src/components/Homie3DActorShell.tsx
- ui/src/lib/homieCompanion.ts
- ui/src/lib/homieMemory.ts
- ui/src/lib/version.ts
- .oddengine_last_ui_version.txt
- docs/RELATIONAL_MEMORY_AND_CHECK_IN_PASS.md

## Notes
- This is still lightweight local relational memory, not deep psychological profiling.
- The goal is continuity that feels warm and honest, not invasive.
- Check-ins are deduped so repeated same-thread turns should not flood memory too aggressively.
