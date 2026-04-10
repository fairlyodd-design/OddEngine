v10.25.1_DragScopeLockHotfix

Purpose:
Lock the snap/drag system to intended top-level workspace cards only, and stop nested Grocery widgets from being treated like draggable windows.

Included fixes:
- CardGODMode now manages only explicit top-level cards:
  - Trading main lane cards by known IDs
  - cards with data-card-root="true"
  - cards with explicit id attributes
- Drag start is now header-only. No fallback drag from the full card body.
- Drag start ignores interactive/nested targets:
  button, input, textarea, select, option, links, contenteditable, data-no-drag, data-no-snap
- One-time drag-scope hotfix reset key added so old saved nested card layouts are cleared.
- GroceryMeals inner sections are explicitly marked data-no-drag/data-no-snap:
  - Savings overview
  - Pantry + savings lane
  - Weekly meal plan
  - Generated grocery list
  - Store profiles + store plan
  - Coupon matches
  - Price book
  - Coupon / deals feed

Files changed:
- ui/src/components/CardGODMode.tsx
- ui/src/panels/GroceryMeals.tsx

Validation notes:
- CardGODMode.tsx passed an esbuild syntax/bundle parse with react marked external.
- GroceryMeals.tsx parse was not fully bundle-validated here because the uploaded project snapshot does not include all runtime dependencies in this environment.

Intentional behavior change:
- This hotfix narrows drag scope for safety. It prioritizes stability over broad auto-draggability.
