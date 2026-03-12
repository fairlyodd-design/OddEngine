# v10.24.80 Grocery Completion Pass merge guide

This pass is designed for the existing `ui/src/panels/GroceryMeals.tsx` seam on the current branch.

## What it adds
- shopping-list-linked deal + coupon matching
- stronger "best trip today" logic
- account/settings placeholders for stores
- budget / pickup / delivery completion controls
- missing-item detector

## 1) Add import
Add this near the other Grocery imports:

```ts
import { buildShoppingListDealMatches } from "../lib/groceryCompletion";
```

## 2) Add completion state
Near the existing `useState` block inside `GroceryMeals`:

```ts
const [storeAccountsNote, setStoreAccountsNote] = useState(() => String(loadJSON("oddengine:grocery:storeAccountsNote:v1", "")));
const [savedTemplates, setSavedTemplates] = useState<string[]>(() => loadJSON("oddengine:grocery:savedTemplates:v1", ["Family staples", "Cheap week", "Party run"]));
const [bestTripToday, setBestTripToday] = useState<string>("");
const [missingDealItems, setMissingDealItems] = useState<string[]>([]);
```

Persist them with `saveJSON(...)` in your existing effects.

## 3) Build completion result from the current list/feed/proxy
Add a memo:

```ts
const completion = useMemo(() => buildShoppingListDealMatches({
  groceryList: state.groceryList,
  preferredStores: state.preferredStores,
  couponFeed: state.couponFeed,
  proxyDeals: [],
  zipCode: state.zipCode,
  fulfillmentMode: state.fulfillmentMode,
  basketGoal: state.basketGoal,
  pantry: state.pantry,
}), [state.groceryList, state.preferredStores, state.couponFeed, state.zipCode, state.fulfillmentMode, state.basketGoal, state.pantry]);
```

If your proxy fetch already returns deals in a local state array, pass them into `proxyDeals`.

## 4) Sync completion outputs back into the panel state
Use an effect like:

```ts
useEffect(() => {
  setMissingDealItems(completion.missingItems);
  setBestTripToday(completion.storePlan[0] || "");
}, [completion]);
```

If you want the panel to auto-fill the existing fields:

```ts
useEffect(() => {
  setState((prev) => ({
    ...prev,
    couponMatches: completion.couponMatches,
    storePlan: completion.storePlan,
    aiDealNote: completion.dealHunterNote,
  }));
}, [completion.couponMatches, completion.storePlan, completion.dealHunterNote]);
```

## 5) Add the Grocery Completion UI block
Drop this near the top half of the panel, after the shopping list / coupon lane area:

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">GROCERY COMPLETION</div>
  <div className="sub mt-2">
    Find deals and coupons related to the current shopping list, tighten the trip route, and keep household grocery settings in one place.
  </div>

  <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
    <div className="card softCard">
      <div className="small shellEyebrow">BEST TRIP TODAY</div>
      <div className="small mt-2"><b>{bestTripToday || "No best-trip route yet."}</b></div>
      <div className="small mt-2">{completion.dealHunterNote}</div>
      <div className="small mt-2"><b>Missing strong matches:</b> {missingDealItems.length ? missingDealItems.join(", ") : "None"}</div>
    </div>

    <div className="card softCard">
      <div className="small shellEyebrow">STORE + ACCOUNT NOTES</div>
      <textarea
        className="input mt-2"
        rows={6}
        value={storeAccountsNote}
        onChange={(e) => setStoreAccountsNote(e.target.value)}
        placeholder="Walmart pickup account / Smith's digital coupons / Amazon Fresh login notes / household preferences"
      />
    </div>
  </div>

  <div className="card softCard mt-4">
    <div className="small shellEyebrow">SHOPPING-LIST-LINKED DEALS</div>
    <div className="mt-3" style={{ display: "grid", gap: 10 }}>
      {completion.matchedDeals.map((row) => (
        <div key={`${row.item}-${row.matchedTitle}`} className="card softCard">
          <div className="small shellEyebrow">{row.matchedStore}</div>
          <div className="small mt-2"><b>{row.item}</b> → {row.matchedTitle}</div>
          <div className="small mt-2">Score: {row.score || 0} • {row.savingsHint}</div>
        </div>
      ))}
    </div>
  </div>
</div>
```

## 6) Add saved grocery templates
Somewhere near your meal / basket controls:

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">HOUSEHOLD TEMPLATES</div>
  <div className="row wrap mt-3">
    {savedTemplates.map((name) => (
      <button key={name} className="tabBtn">{name}</button>
    ))}
  </div>
</div>
```

## 7) Build target
After wiring this in, the Grocery panel should:
- find deals and coupons related to the shopping list
- show a best trip today summary
- call out missing list items with no strong deal angle
- keep account/settings notes visible for the household
