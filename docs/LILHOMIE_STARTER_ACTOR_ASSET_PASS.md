# v10.26.14l — LilHomie Starter Actor Asset Pass

This pass ships a real `lilhomie.glb` asset so the 3D Homie shell stops being just a pipeline and starts having an actual character actor by default.

## What ships

- `ui/public/models/lilhomie.glb`
- `ui/public/models/lilhomie.manifest.json`
- `scripts/build_lilhomie_glb.py`

## Character look

The shipped actor is a stylized low-poly mascot companion with:

- dark hoodie body
- teal glow hoodie shell
- silver cap
- mascot face card using the existing Homie texture
- separate arm / leg / jaw nodes

## Included clips

- `Idle`
- `Walk`
- `Talk`
- `Listen`

These are exported as real glTF animation clips, so the existing Homie actor shell can blend between them without needing Blender on day one.

## Why this version exists

The previous pass gave the OS a real rig pipeline, but it still required a finished custom GLB to be dropped in later.
This pass closes that gap by shipping a starter actor that works immediately while still leaving the door open for a future handcrafted hero rig.

## Notes

- this starter actor uses transform animation clips, not a fully skinned production rig
- the face is driven by the existing mascot texture
- the manifest is tuned for the current in-app stage
- you can regenerate or customize the asset with `scripts/build_lilhomie_glb.py`

## Validation

- `lilhomie.glb` parses as glTF 2.0
- clip names present: Idle / Walk / Talk / Listen
- mesh count and node hierarchy present
