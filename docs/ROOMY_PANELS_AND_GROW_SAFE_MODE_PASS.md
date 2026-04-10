# v10.26.12m Roomy Panels + Grow Safe Mode Pass

## Goals
- Unsquish the most cramped panels called out in review: Home, Builder, Grocery Meals, Writers Lounge.
- Reduce Grow panel compositor/demon-glitch risk by giving Grow the same safe-mode shell handling Games already had.
- Keep the broader shell/theming/money work intact.

## Main changes
- Added container-aware panel roots for Home, Grocery Meals, Writers Lounge, Builder, and Grow.
- Home now collapses to a single main lane earlier and turns its widget rail into a 2-up strip before going single-column.
- Builder was rebuilt into a roomier workbench with a hero, metrics, scene graph lane, full preview lane, and inspector lane.
- Grocery Meals internal 2-column sections now breathe more and collapse earlier within the available panel width.
- Writers Lounge gets a roomier three-lane desktop arrangement and collapses to one column earlier based on container width.
- Grow now opts into compositor-safe shell mode when active and uses flatter card treatment in that mode.
- Grow panel normalization is forced into a stable vertical flow instead of fighting outer auto-grid behavior.

## Files touched
- `ui/src/App.tsx`
- `ui/src/lib/version.ts`
- `ui/src/styles.css`
- `ui/src/panels/Home.tsx`
- `ui/src/panels/Builder.tsx`
- `ui/src/panels/GroceryMeals.tsx`
- `ui/src/panels/Books.tsx`
- `ui/src/panels/Grow.tsx`

## Notes
- This pass is intentionally targeted at panel breathing room and Grow stability.
- It does not claim to fix unrelated pre-existing repo issues outside these touched files.
