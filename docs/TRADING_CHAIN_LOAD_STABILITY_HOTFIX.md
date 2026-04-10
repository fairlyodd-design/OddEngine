# v10.26.9e Trading Chain Load Stability Hotfix

This pass keeps the top Trading command deck fixed while chain data loads.

## What changed
- moved heavy public penny sniper contract rows into a dedicated lower results section
- capped visible sniper preview rows to 6
- added clean empty/loading/loaded/error states for chain-driven sniper results
- kept the top command deck on a stable control lane so loading a chain no longer stretches the header layout

## Files changed
- ui/src/panels/Trading.tsx
- ui/src/lib/version.ts
- ui/package.json
- package.json
- .oddengine_last_ui_version.txt
