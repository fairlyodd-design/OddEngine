# v10.26.14i — Detached Avatar + Companion Memory Lane Pass

## What changed

- Homie companion now starts detached by default in desktop mode when the companion window preference is on.
- Main shell hides the duplicate in-shell Homie bubble while detached mode is active.
- Standalone Homie Buddy gets a larger animated avatar stage so the companion feels more like a game-style presence.
- Homie memory now includes:
  - pinned facts
  - relationship milestones
  - per-panel mood/context memory
- Homie panel exposes a real companion memory lane for pinning focus, saving milestones, and reviewing panel-aware memory.
- Companion prompt building now feeds panel mood/context memory, pinned facts, and milestones into provider chat.
- Single detached companion window uses a stable `homie-buddy` window type so bounds persistence works cleanly.

## Touched files

- `ui/src/App.tsx`
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/panels/Preferences.tsx`
- `ui/src/lib/homieMemory.ts`
- `ui/src/lib/homieCompanion.ts`
- `ui/src/lib/version.ts`
- `ui/src/styles.css`

## Validation

- TypeScript transpile checks passed for the touched TS/TSX files.
- This remains source-level validation, not a full dependency-installed production build.
