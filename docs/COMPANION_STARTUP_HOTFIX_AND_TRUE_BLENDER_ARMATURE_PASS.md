# v10.26.14p — Companion Startup Hotfix + True Blender Armature Pass

This pass does two jobs together:

1. fixes the detached Homie startup path so the companion window is easier to see and less likely to boot into a thin broken strip
2. adds the real Blender armature pipeline scaffolding so Lil Homie can move from procedural starter actor to a true rigged character

## Startup hotfix

- detached Homie now opens with larger safe defaults
- stale tiny/off-screen companion bounds are sanitized before launch
- companion window uses a normal frame by default so it is easier to drag, resize, and verify as a real detached window
- standalone companion route is wrapped more defensively inside the shell
- forced-panel help modal prop mismatch in `App.tsx` is corrected
- `Homie.tsx` now resolves panel labels safely for memory lane buttons

## True Blender armature pipeline

Added files:

- `scripts/lilhomie_blender_armature_helper.py`
- `scripts/lilhomie_blender_viseme_shape_keys_helper.py`
- `ui/public/models/lilhomie.armature.manifest.template.json`

### What these do

`lilhomie_blender_armature_helper.py`
- creates / normalizes a simple humanoid armature
- ensures the expected bone names exist
- parents the selected mesh to the armature with automatic weights
- sets action names the runtime expects: `Idle`, `Walk`, `Talk`, `Listen`

`lilhomie_blender_viseme_shape_keys_helper.py`
- ensures the export-friendly shape key names exist
- sets up the common mouth / blink names the runtime manifest already understands
- keeps the naming consistent for later lip-sync polish

`lilhomie.armature.manifest.template.json`
- starter naming contract for bones, clips, and blendshape aliases
- easier handoff between Blender export and the in-OS runtime

## Honest scope

This pass **does not claim** a finished custom Blender hero rig asset is complete inside this zip.
It gives you the real startup fix plus the actual rigging lane so the next custom character build has a clean target.

## Recommended next flow

1. open your custom Lil Homie mesh in Blender
2. run `lilhomie_blender_armature_helper.py`
3. run `lilhomie_blender_viseme_shape_keys_helper.py`
4. animate / tune `Idle`, `Walk`, `Talk`, `Listen`
5. export `ui/public/models/lilhomie.glb`
6. tune `ui/public/models/lilhomie.manifest.json` if clip names differ
