v10.35.2_GroceryMealsTrueFamilyFoodSavingsCommandLanePass

What this pass does
- Turns Grocery Meals into a real family food / savings / meal-planning command lane.
- Adds a top-level "What matters today" summary.
- Adds a "Do this now" action card.
- Adds a ranked family food action queue.
- Adds pantry staple status, meal ideas from what is already on hand, and money-saving substitutions.
- Keeps the current meal-plan, grocery-list, coupon, price-book, and store-plan flows.

Files included
- ui/src/panels/GroceryMeals.tsx
- ui/src/lib/groceryMealsCommand.ts

Notes
- Focused drop-in overlay only.
- Does not claim a full repo-wide build outside this panel path.
- Keeps the existing oddengine:groceryMeals:v1 storage key intact.
