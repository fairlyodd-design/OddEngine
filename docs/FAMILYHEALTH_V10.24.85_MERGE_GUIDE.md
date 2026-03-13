# FamilyHealth v10.24.85 merge guide

## 1) Add import

```ts
import {
  buildHouseholdOpsSummary,
  buildHouseholdOpsMarkdown,
} from "../lib/householdOps";
```

## 2) Add derived summary inside the component

```ts
const householdOps = useMemo(() => buildHouseholdOpsSummary(), []);
```

## 3) Add a card near the top of the panel JSX

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">HOUSEHOLD OPS</div>
  <div className="small mt-2"><b>Status:</b> {householdOps.headline}</div>
  <div className="small mt-2"><b>Readiness:</b> {householdOps.householdReadiness}%</div>
  <div className="small mt-2"><b>Detail:</b> {householdOps.detail}</div>
  <div className="small mt-2"><b>Next:</b> {householdOps.nextBestAction}</div>
  {householdOps.blockerList.length ? (
    <div className="note mt-3">{householdOps.blockerList.join(" • ")}</div>
  ) : null}
</div>
```

## 4) Optional: copy markdown summary

```ts
async function copyHouseholdOpsMarkdown() {
  await navigator.clipboard.writeText(buildHouseholdOpsMarkdown(householdOps));
}
```

## 5) Build

```powershell
npm --prefix .\ui run build
```
