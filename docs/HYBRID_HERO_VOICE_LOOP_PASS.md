# v10.26.14x — Hybrid hero avatar + back-and-forth voice pass

This pass does two user-facing things for detached Homie:

1. switches the detached companion toward a friendlier hybrid hero shell that matches the user's locked look more closely (grey hoodie, light-grey cap, glasses, goatee / beard vibe)
2. makes talking back and forth with Homie easier from the detached shell itself with a voice-first control strip

## What changed

- Added a new standalone-friendly **hybrid hero** avatar mode
- Kept the existing 3D rig lane available for later Blender hero-rig work
- Promoted the new hybrid shell as the detached default in this pass
- Added quick voice controls directly in the detached companion chat lane:
  - Start talking / stop listening
  - Back-and-forth on/off
  - Route voice to Homie
  - Replies speak / silent
- Added a one-time standalone primer that nudges voice into companion mode with auto-speak enabled

## Why

The previous detached shell proved the windowing path works, but the current 3D body still reads more like a placeholder than the user's desired friendly companion.
This pass makes the detached shell feel much closer to the target look right now while preserving the true Blender rig path for the next glow-up.
