# v10.26.3b Homie Companion blank window hotfix

This pass adds a safety net so the separate Homie Companion app stops going fully blank when the 3D scene crashes or fails to initialize.

What changed:
- added a reusable React error boundary
- wrapped the 3D scene in a scene-level fallback
- added an app-level fallback for startup crashes
- added a manual safe mode toggle
- added a retry 3D action
- bumped `homie_companion/package.json` to `10.26.3b`

Kid version:
If the 3D buddy trips, Homie now falls onto a soft mat instead of disappearing through the floor.
