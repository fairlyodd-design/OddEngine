# v10.26.14k — Detached Homie Real Rig Pipeline Pass

This pass fixes the detached Homie startup path and upgrades the 3D actor shell into a real rig pipeline.

## What changed

- added a dedicated Electron `ensureHomieCompanionWindow` path so Homie opens as a true detached companion window instead of relying on the generic pop-out route
- stronger one-time migration to re-enable detached Homie on installs that carried an older inline preference forward
- first launch of this pass recenters the detached Homie window so stale/off-screen buddy bounds do not strand the companion
- Homie panel now has a direct **Launch / focus detached Homie** button
- upgraded `LilHomie3D` to support a sibling `lilhomie.manifest.json` file for clip aliases and morph aliases
- added optional `Listen` animation support and blink morph support
- added `scripts/lilhomie_blender_glb_export_helper.py` for Blender export

## Real rig pipeline

Drop these files into `ui/public/models/`:

- `lilhomie.glb`
- `lilhomie.manifest.json`

Recommended clips:

- Idle
- Walk
- Talk
- Listen

Optional morph targets:

- mouthOpen / jawOpen / viseme_aa
- blink / eyeClose

If your real rig uses different names, update the manifest aliases instead of changing code.

## Validation

- `ui/src/App.tsx` transpile parse check
- `ui/src/components/LilHomie3D.tsx` transpile parse check
- `ui/src/panels/Homie.tsx` transpile parse check
- `ui/src/panels/Preferences.tsx` transpile parse check
- `electron/main.cjs` node syntax check
- `electron/preload.cjs` node syntax check
