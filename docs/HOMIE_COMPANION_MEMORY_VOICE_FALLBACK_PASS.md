# v10.26.14h — Homie Companion Memory + Voice Fallback Pass

## What changed

- Added a stronger companion runtime in `ui/src/lib/homieCompanion.ts` with:
  - rolling local memory
  - session summary
  - remembered user lines
  - provider auto-fallback
  - provider probing across all configured lanes
- Upgraded `HomieBuddy` so conversational voice turns can:
  - respect a voice routing mode (`smart`, `companion`, `commands`)
  - wait for Homie's spoken reply before re-arming continuous listening
  - auto-speak replies when enabled
- Expanded the full `Homie` panel with:
  - check-all-provider lane
  - voice routing selector
  - auto-speak toggle
  - auto-fallback toggle
  - rolling memory toggle
  - compact companion memory readout

## Why this pass matters

This moves Homie closer to a real companion instead of just a command box.
The buddy can now keep more continuity across the conversation, survive a failed provider by falling back to another configured lane, and behave more naturally during voice back-and-forth.

## Validation

Source-level validation completed with TypeScript transpile checks for:

- `ui/src/lib/homieCompanion.ts`
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/App.tsx`

This is not a full dependency-installed production build validation.
