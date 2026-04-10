# v10.26.15g1 Face-to-face layering hotfix pass

## Goal
Keep detached Homie visibly present when the live camera preview is enabled, especially in medium-width detached windows where the responsive camera card was expanding across the stage and covering most of the avatar.

## What changed
- kept the right-docked face-to-face preview layout active for medium desktop widths instead of collapsing too early
- only switch to the full-width stacked camera card on genuinely narrow layouts
- nudged detached face-to-face actor framing slightly left/up so Homie stays readable beside the preview card
- raised actor, hint, and nameplate layering so the companion presence lane remains visually coherent
- added a bit more bottom breathing room for the face-to-face stage

## Result
Detached Homie should no longer feel buried under the camera preview in normal desktop window sizes. The face-to-face lane should read as:
- Homie visible
- live preview docked beside the companion
- stage hint and nameplate still readable

## Straight truth
This is a layout/layering hotfix, not a behavioral pass. Camera presence and turn-taking logic are unchanged here.
