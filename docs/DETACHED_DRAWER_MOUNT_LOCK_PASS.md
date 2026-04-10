# v10.26.15l_DetachedDrawerMountLockPass

This pass locks the detached Homie support lanes into a real slide-over drawer so the base companion shell stops reflowing when diagnostics, transcript preview, provider checks, or reply previews update.

## Goals

- keep the detached shell visually stable in narrow windows
- move Hear-You Doctor into a locked drawer view instead of inline flow
- confine drawer scrolling to the drawer body only
- prevent diagnostics/provider/transcript updates from changing the main detached card height
- keep narrow detached windows usable with an overlay drawer instead of an inline stack

## Main changes

- added an internal tools drawer view switch between `main` and `doctor`
- updated the detached tools drawer header with Back / Close controls when the doctor view is open
- wrapped standalone House and Tools drawers in a dedicated scroll body
- changed standalone drawer CSS from in-flow fallback to a fixed overlay / bottom-sheet style on narrow widths
- added layout containment and overscroll containment to the standalone drawer
- added min-height stabilization for quick chip rows so they stop nudging nearby content
- added a detached drawer explainer card in the tools main view

## Touched files

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`
- `.oddengine_last_ui_version.txt`
- `docs/DETACHED_DRAWER_MOUNT_LOCK_PASS.md`

## Validation

- source-level TypeScript transpile checks were run on the touched TS/TSX files
- full production build was not run in this handoff copy
