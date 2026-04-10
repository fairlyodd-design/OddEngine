# Single Hero Detached Companion Layout Pass

## Goal
Make the detached Homie window feel more like a game companion shell instead of a stacked dashboard.

## What changed
- Big hero actor stage stays at the top of the detached companion window.
- The real companion chat lane is kept directly under the actor stage.
- House controls now live in a slide-out drawer.
- Tools, voice, diagnostics, and quick steering now live in a separate slide-out drawer.
- Detached chat is visually compacted for a cleaner companion-first layout.

## Files touched
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`

## Notes
This pass is UI/layout focused. It keeps the existing detached companion behavior and refines the standalone presentation.
