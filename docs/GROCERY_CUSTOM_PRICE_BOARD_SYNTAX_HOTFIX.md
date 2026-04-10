# v10.26.6c Grocery Custom Price Board Syntax Hotfix

Fixes a missing closing `</div>` in `ui/src/panels/GroceryMeals.tsx` that caused Vite/Babel to throw an “Unterminated JSX contents” error.

## What changed
- Closed the top summary shell before the planner tab conditional
- Bumped package/UI version labels to `10.26.6c`

## Best move
1. Close OddEngine
2. Apply the overlay
3. Relaunch normally
