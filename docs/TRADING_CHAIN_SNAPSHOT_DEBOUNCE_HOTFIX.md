# v10.26.9g Trading Chain Snapshot Debounce Hotfix

This pass keeps the last good loaded chain snapshot visible while a fresh chain is loading.

## What changed
- preserves the last stable chain in memory while refresh is running
- keeps the selected contract key when it still exists in the fresh chain
- keeps the top Trading deck stable during refresh
- shows a light refresh veil instead of blanking the sniper board
- avoids clearing the chain on scan errors when a last-good snapshot exists

## Files changed
- `ui/src/panels/Trading.tsx`
- `ui/src/lib/version.ts`
- `ui/package.json`
- `package.json`
- `.oddengine_last_ui_version.txt`
