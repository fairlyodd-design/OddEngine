# v10.26.14j — Detached Homie Hotfix + 3D Shell Scaffold Pass

## What changed
- Fixed detached Homie startup so the desktop shell launches the companion window again without the stale session gate.
- Promoted detached companion mode and the standalone actor shell as the default desktop path.
- Added a standalone 3D actor shell that uses the existing LilHomie3D renderer inside the Homie companion window.
- Added a configurable GLB model path for a real rig drop-in.
- Added a new shell lane in the Homie panel to switch between the 3D actor shell and the 2.5D Homie House.

## 3D rig pipeline
- Default model path: `/models/lilhomie.glb`
- Preferred animation names: `Idle`, `Walk`, `Talk`
- Optional mouth morphs: `MouthOpen`, `JawOpen`, `viseme_aa`
- If the GLB is missing, Homie falls back to the built-in lightweight 3D mascot body so the detached shell still works.

## Validation
- TypeScript transpile checks for touched UI files
- `electron/main.cjs` node syntax check

## Notes
This pass ships a **3D-ready actor shell scaffold**. A true custom character rig still depends on a GLB/rig asset matching the pipeline.
