# v10.26.14w - Camera Beat + Friendly Hybrid Hero Stage Pass

## Goal
Make the detached Homie window feel more like a game companion with subtle camera beats, clearer idle stage states, and a friendlier rounded companion shell that blends the user's grey-hoodie emoji look with a softer animated AI-buddy vibe.

## What changed
- Upgraded the detached 3D actor shell into a more cinematic hero stage.
- Added stage states:
  - idle
  - listening
  - thinking
  - talking
  - celebrating
- Added subtle camera beats:
  - hero
  - close
  - focus-left
  - focus-right
- Added rounded soft-glow stage styling, constellations, floating blobs, and softer shell framing.
- Tuned the 3D runtime so posture changes between listening / thinking / talking / celebrating.
- Passed companion busy state into the actor shell so Homie can look like it is thinking while the model is generating a reply.
- Bumped app version to `10.26.14w`.

## Files touched
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/Homie3DActorShell.tsx`
- `ui/src/components/LilHomie3D.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`

## Notes
This is a UI/runtime pass, not a new Blender-exported custom mesh. It improves the detached stage feel immediately while keeping the true hero rig pipeline intact.
