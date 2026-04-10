# Multi Monitor Workspace Manager Pass

Adds per-panel monitor targeting on top of detachable windows and saved workspace layouts.

## What changed
- adds a monitor manager card to the workstation layout builder
- reads connected desktop displays from Electron and exposes them in the UI
- adds global per-panel display defaults so panels like Trading, News, and Homie can always target the same monitor
- adds workspace-specific monitor overrides for saved desk layouts
- workspace open + tile now pass explicit display assignments into the desktop tiler
- single-panel pop-outs now honor their saved display target too
- active panel workstation bar now includes a quick display selector

## Operator flow
1. Pick a default monitor for high-priority panels like Trading, News, and Homie.
2. Save a workspace with custom per-panel monitor overrides when a desk needs a special map.
3. Reopen or tile the workspace.
4. Each panel lands on the intended screen while still keeping remembered size and placement on that screen.
