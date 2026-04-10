# v10.26.9f Trading Chain Render Thrash Hotfix

This hotfix stabilizes the Trading panel when an options chain loads.

## Fixes
- removes accidental duplicated helper blocks that were being recreated inside chart and table render callbacks
- caps contract table render rows for stability
- caps chart inputs so heavy chain loads do not blank the panel
- keeps the top deck stable while the lower chain sections update

## Files
- ui/src/panels/Trading.tsx
- ui/src/lib/version.ts
- ui/package.json
- package.json
- .oddengine_last_ui_version.txt
