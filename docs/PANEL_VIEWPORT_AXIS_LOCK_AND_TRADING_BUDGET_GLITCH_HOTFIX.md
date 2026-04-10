# v10.26.11s Panel Viewport Axis Lock + Trading/Family Budget Glitch Hotfix

This pass targets the scrolling/glitch behavior seen in Trading and Family Budget where the desktop main viewport can drift sideways while long or wide panel content is mounted.

## What changed

- Locked the desktop main viewport to vertical scrolling only.
- Added horizontal-scroll clamping while Trading is mounted.
- Added horizontal-scroll clamping while Family Budget is mounted.
- Added width/min-width guards to panel shells and affected panel roots.
- Preserved local horizontal scrolling for inner table wrappers instead of the whole desktop viewport.
