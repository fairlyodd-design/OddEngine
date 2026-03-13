# GroceryMeals v10.24.96 merge guide

Add this import near the top of `ui/src/panels/GroceryMeals.tsx`:

```ts
import SwagbucksLane from "../components/SwagbucksLane";
import { toShoppingItems } from "../lib/grocerySwagbucks";
```

## Build a raw items array
Where your Grocery panel already has a shopping list / pantry / basket model, map it into a simple array:

```ts
const swagbucksItems = toShoppingItems(
  currentListItems.map((item) => ({
    title: item.title,
    qty: item.qty,
    category: item.category,
  })),
);
```

If your current list is just strings:

```ts
const swagbucksItems = toShoppingItems(currentListItems);
```

## Render the Swagbucks lane
Place this below your coupon / deals area or savings summary:

```tsx
<SwagbucksLane rawItems={swagbucksItems} />
```

## Good place in the panel
Use it where the user is already making value decisions:
- below “best trip today”
- below list/deals/coupons
- above pantry templates
