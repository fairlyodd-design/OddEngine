# v10.26.11n Trading Truth Sync And Workflow Lane Hotfix

This hotfix tightens the Trading desk after the panel walkthrough video.

## What it fixes

- adds a local `oddengine:trading:status:v1` truth snapshot so the Trading panel and Trading Coach read from the same state lane
- clears stale chain snapshot state when a fresh scan fails, instead of leaving ghost chain context behind
- gives the coach a better read for:
  - snapshot loaded vs no chain
  - selected contract
  - stale AI thesis notes
  - symbol mismatch between the requested ticker and the currently loaded chain
- surfaces a small in-panel warning when notes still reflect an older symbol and the thesis should be refreshed

## Why this pass exists

The walkthrough showed the OS was broadly stable, but the Trading lane still had truth-sync drift:

- the desk could have a loaded snapshot while the coach still read the lane as empty
- notes could keep an older ticker thesis after the active symbol changed
- chain failures could leave stale context around long enough to confuse the rail

## Main files changed

- `ui/src/panels/Trading.tsx`
- `ui/src/lib/brain.ts`
- `ui/src/lib/version.ts`
- `package.json`
- `ui/package.json`
- `homie_companion/package.json`
- `.oddengine_last_ui_version.txt`

## Honest note

This is a source/drop-in hotfix focused on state truth and workflow clarity. It does not add live brokerage execution or guarantee third-party market data quality.
