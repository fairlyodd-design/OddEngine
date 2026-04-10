# v10.26.12g — Calendar Cleanup + Recovery-Aware Money Planner Pass

## What changed

### Calendar cleanup
- Rebuilt the Calendar panel layout so it feels less cramped.
- Added a roomier month board with larger cells.
- Added stat tiles for month volume, selected-day count, next-7-days count, and linked-panel count.
- Split the right rail into:
  - Selected day agenda
  - Upcoming list
  - Linked panels summary
- Kept the local-first storage and panel-link workflow intact.

### Recovery-aware planner
- Added `ui/src/lib/recoveryPlanner.ts`.
- Reads the latest Happy Healthy entry when available.
- Builds a recovery profile from:
  - energy
  - pain / symptom load
  - hydration
  - red-flag count
  - available time window
  - planner mode (auto / recovery / steady / push)
- Applies recovery-fit adjustments to:
  - Money Vacuum
  - Income Scout
  - Money Autopilot ordering (through the underlying Money Vacuum scan)

## New behavior
- Low-energy or high-symptom days will prefer:
  - savings / budget moves
  - light admin
  - no-upfront legit lanes
  - short-window tasks
- Higher-energy days can surface:
  - deeper build work
  - launch tasks
  - selective higher-focus lanes
- Capital-sensitive moves like Trading are penalized harder when capacity is low.

## Surfaces updated
- Brain Mission Control
- Money panel
- Home money card
- Trading money strip
- Family Budget money strip
- Mining money strip
- Game Time money strip

## Validation
- Targeted esbuild syntax checks passed for the touched files.
- Full `tsc --noEmit` still stops on pre-existing unrelated syntax issues in `ui/src/panels/Plugins.tsx`.
