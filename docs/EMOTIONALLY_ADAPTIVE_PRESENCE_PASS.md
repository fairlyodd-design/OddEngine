# v10.26.15g — Emotionally Adaptive Presence Pass

## Goal
Make Homie feel more like a steady ongoing friend by tuning emotional pacing, softer acknowledgements, and continuity-aware companion replies.

## What changed
- Added emotional pacing memory signals:
  - acknowledgement style
  - emotional pacing line
  - continuity cue
- Prompt shaping now tells Homie to:
  - start hard moments with a tiny real acknowledgement
  - lower the hype when the user sounds worn down
  - lightly lift the energy only when the user does
  - keep continuity honest and helpful instead of clingy
- Detached Homie now:
  - reads the current turn for soft / steady / lift energy
  - updates status with warmer live-presence phrasing
  - inserts a tiny reply beat before speaking so replies land less abruptly
  - uses longer auto-resume spacing after softer turns
  - clears delayed reply timers when the user interrupts or restarts listening

## Touched files
- ui/src/components/HomieBuddy.tsx
- ui/src/lib/homieCompanion.ts
- ui/src/lib/homieMemory.ts
- ui/src/lib/version.ts
- .oddengine_last_ui_version.txt

## Notes
- This is a companion-presence pass, not deep emotional analysis.
- Homie should feel more natural and less transactional, but it still stays grounded and truthful.
- The delayed reply beat is intentionally small so the app still feels responsive.
