# v10.26.12l Embedded Homie Core Pass

## Goal
Turn Homie from a separate helper panel into the shell-wide brain + companion layer for FairlyOdd OS.

## What changed
- Added a new `EmbeddedHomieCore` card to the Mission Control / activity rail so Homie is always present across the OS.
- Added `ui/src/lib/homieCore.ts` to build a live snapshot from:
  - active panel context
  - recovery planner state
  - Income Sniper best move
  - Money Autopilot next move
  - mission / notes / goals counts
- Added a shell-level Homie line in the main shell summary so the current panel always has a top-level companion readout.
- Added a persistent “Ask Homie from anywhere” lane with prompt chips and manual input.
- Added Homie draft handoff support so embedded prompts open the full Homie panel with the drafted message already loaded.
- Added a Preferences toggle for `Embedded Homie Core`.
- Updated app version to `10.26.12l`.

## Main files touched
- `ui/src/lib/homieCore.ts`
- `ui/src/components/EmbeddedHomieCore.tsx`
- `ui/src/components/ActivityRail.tsx`
- `ui/src/App.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/panels/Preferences.tsx`
- `ui/src/lib/prefs.ts`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`

## Validation
- Targeted TypeScript transpile parsing passed on the touched files.
- Full project `tsc --noEmit` still stops on pre-existing unrelated syntax issues in `ui/src/panels/Plugins.tsx`.
