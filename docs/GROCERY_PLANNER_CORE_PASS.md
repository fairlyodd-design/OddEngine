# v10.26.5 Grocery Planner Core Pass

This pass turns Grocery Meals into a real shopping-list planner instead of only a deal-view panel.

## What changed

- Added a new **Planner core** tab.
- Added **shopping list entry** with item name, quantity, and store zone.
- Added **store-zone sections**:
  - Produce
  - Meat / protein
  - Dairy
  - Frozen
  - Pantry
  - Household
- Added **meal-to-cart** flow so meal cards can push ingredients into the live list.
- Added **Need / Have / Maybe** toggles on each item.
- Added **check-off while shopping** behavior.
- Added **local autosave** back into `oddengine:groceryMeals:v1`.
- Added **grocery budget bridge snapshot saving** so Family Budget / Home can read the grocery lane better.
- Added queued-action handling for:
  - `grocery:build-list`
  - `grocery:coupon-lane`
  - `system:reload-from-storage`

## Files touched

- `ui/src/panels/GroceryMeals.tsx`
- `ui/src/lib/version.ts`
- `package.json`
- `ui/package.json`
- `.oddengine_last_ui_version.txt`
- `docs/GROCERY_PLANNER_CORE_PASS.md`

## Kid version

1. Open **Grocery Meals**.
2. Stay on **Planner core**.
3. Add items yourself or click a meal button to drop meal ingredients into the list.
4. Sort the trip by zone.
5. Mark each item as **Need**, **Have**, or **Maybe**.
6. Check things off while shopping.
7. Close the app and come back later — the list should still be there.
