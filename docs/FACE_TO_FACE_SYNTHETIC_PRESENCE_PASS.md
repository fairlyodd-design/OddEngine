# v10.26.15e Face-to-Face Synthetic Presence Pass

This pass tightens the detached Homie face-to-face loop so camera, stage, and voice interruptions feel more like one live conversation.

## What changed

- the detached hybrid / 3D shell now supports a face-to-face mode with a live camera preview pip right inside the stage
- stage camera beats are retuned when camera mode is on so Homie feels more like it is looking at you, listening, thinking, and replying inside one shared frame
- speech interruption handling is safer: cancelling a reply can no longer let stale speech callbacks yank the avatar back to ready mid-turn
- the main detached voice button now becomes **Interrupt + talk** while Homie is speaking
- relationship continuity can now surface directly inside the detached stage meta so the conversation feels warmer across sessions
- if you use the hybrid / actor shell, the camera preview is docked into the stage instead of living as a separate large widget below it

## Touched files

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/Homie3DActorShell.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`
- `.oddengine_last_ui_version.txt`

## Best test

1. open detached Homie
2. turn **Use camera** on
3. start a real back-and-forth voice turn
4. interrupt Homie while it is replying
5. confirm the shell stays visually coherent: warmup -> listening -> thinking -> replying, without a weird snap back to ready

## Straight truth

This is a presence/framing pass, not full computer vision. The live camera preview helps the companion feel face-to-face, but Homie still should not pretend it understands visual details unless another real analysis path is wired in.
