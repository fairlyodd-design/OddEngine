# GroceryMeals merge guide for v10.24.82

## Goal
Let Grocery read setup status from the Connections Center and show:
- provider setup ready / missing
- completion percent
- missing zip/base URL/provider inputs
- shortcut to Preferences

## 1) Import

```ts
import { buildPanelConnectionStatus, buildMissingInputsLabel } from "../lib/panelConnections";
```

## 2) Add derived status

```ts
const grocerySetup = useMemo(() => buildPanelConnectionStatus("GroceryMeals"), []);
```

## 3) Add a setup summary card near the top

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">GROCERY SETUP</div>
  <div className="small mt-2">
    <b>Status:</b> {grocerySetup.ready ? "Ready" : "Needs setup"}
  </div>
  <div className="small mt-2">
    <b>Completion:</b> {grocerySetup.completionPercent}%
  </div>
  <div className="small mt-2">
    <b>Missing:</b> {buildMissingInputsLabel(grocerySetup)}
  </div>
  <div className="note mt-3">
    Configure grocery provider base URL, zip code, and optional store credentials in Preferences → Connections Center.
  </div>
</div>
```

## 4) Optional
Disable live deal fetch until required grocery inputs are present.
