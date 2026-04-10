# v10.26.14t — True Blender Hero Rig Pass

This pass takes detached Homie from a starter-actor shell into a real Blender hero-rig pipeline.

## What changed

### Runtime
- expanded `ui/src/components/LilHomie3D.tsx`
- runtime now supports:
  - full viseme groups
  - configurable blink timing
  - expression morphs for idle / talk / listen
  - smoother facial state switching on a real exported face rig

### Model manifest + templates
- upgraded `ui/public/models/lilhomie.manifest.json`
- upgraded `ui/public/models/lilhomie.armature.manifest.template.json`
- added `ui/public/models/lilhomie.hero.rig.recipe.json`
- added `ui/public/models/lilhomie.blender.export.template.json`
- updated `ui/public/models/README.md`

### Blender helpers
- added `scripts/lilhomie_blender_hero_rig_setup.py`
  - predictable humanoid armature
  - starter hero-rig bones
  - expected viseme / blink / expression keys
  - starter Idle / Walk / Talk / Listen actions
- added `scripts/lilhomie_blender_action_clips_helper.py`
  - cleaner starter motion loops for polishing
- added `scripts/lilhomie_blender_export_bundle.py`
  - exports `ui/public/models/lilhomie.glb`
  - writes sibling `ui/public/models/lilhomie.manifest.json`

### Homie panel
- added a dedicated **True Blender hero rig lane**
- documents the new helper scripts + expected viseme set

## Intent
This is the first pass where the detached companion is set up to benefit from a **real Blender hero rig** instead of only a starter fallback asset.

## Truthful scope
This pass ships the **runtime + Blender helper pipeline**, not a brand new hand-authored custom GLB made in Blender here in the container.

That means:
- the detached companion can now use a proper hero rig when you export one
- the starter runtime understands richer facial data immediately
- the next pass after this can focus on the actual custom head mesh / weights / animation polish in Blender
