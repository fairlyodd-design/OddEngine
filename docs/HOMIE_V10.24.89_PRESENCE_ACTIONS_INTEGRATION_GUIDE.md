# Homie v10.24.89 Presence + Actions integration guide

Goal:
make Homie feel panel-aware and useful across the OS without a risky full panel overwrite.

## 1) Add the import near the top of `ui/src/panels/Homie.tsx`

```ts
import {
  buildHomiePanelContext,
  buildHomiePresenceSnapshot,
  presenceStateToAvatarMode,
  type HomiePanelContext,
} from "../lib/homiePresenceActions";
```

## 2) Build panel contexts inside `Homie()`

Create a small list of panel summaries that matter most right now:

```ts
const panelContexts: HomiePanelContext[] = [
  buildHomiePanelContext("Home", "Home", {
    summary: "Mission control overview for the family OS.",
    completionPercent: 80,
    ready: true,
  }),
  buildHomiePanelContext("Books", "Studio", {
    summary: "Idea-to-product creative workspace.",
    completionPercent: 75,
    ready: true,
  }),
  buildHomiePanelContext("GroceryMeals", "Grocery Meals", {
    summary: "Household grocery planning, deals, and saver flow.",
    completionPercent: 70,
    ready: true,
  }),
  buildHomiePanelContext("FamilyBudget", "Family Budget", {
    summary: "Household budget, runway, and spending health.",
    completionPercent: 65,
    ready: true,
  }),
  buildHomiePanelContext("Preferences", "Preferences", {
    summary: "Connections, secrets, and OS setup center.",
    completionPercent: 85,
    ready: true,
  }),
];
```

## 3) Choose the current active panel

If your Homie panel already knows the active panel, map it here.
If not, start with Studio or Home as a safe default.

```ts
const activePanelId = currentPanelId || "Home";
const activePanel =
  panelContexts.find((panel) => panel.panelId === activePanelId) || panelContexts[0];
```

## 4) Build the presence snapshot

```ts
const homiePresence = buildHomiePresenceSnapshot(activePanel, panelContexts);
const avatarMode = presenceStateToAvatarMode(homiePresence.state);
```

## 5) Feed the avatar mode into your Homie avatar

If you already wired `HomieAvatar.tsx` from v10.24.86, pass it:

```tsx
<HomieAvatar mode={avatarMode} />
```

## 6) Add a simple presence card in the Homie UI

```tsx
<div className="card softCard">
  <div className="small shellEyebrow">HOMIE PRESENCE</div>
  <div className="h mt-2">{homiePresence.headline}</div>
  <div className="sub mt-2">{homiePresence.subline}</div>
  <div className="small mt-3"><b>Mood:</b> {homiePresence.moodLabel}</div>
</div>
```

## 7) Add recommended actions

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">NEXT BEST ACTIONS</div>
  <div className="mt-3" style={{ display: "grid", gap: 10 }}>
    {homiePresence.recommended.map((item) => (
      <button
        key={item.id}
        className="card softCard"
        style={{ textAlign: "left" }}
        onClick={() => item.panelId && onNavigate?.(item.panelId)}
      >
        <div className="small"><b>{item.label}</b></div>
        <div className="small mt-1">{item.reason}</div>
      </button>
    ))}
  </div>
</div>
```

## 8) Expected result

Homie should now:
- change mood by panel state
- show what he thinks needs attention
- surface the next best panel/action
- feel much more like an onboard OS assistant than a static buddy box

## 9) Build + test

```powershell
cd C:\OddEngine
npm --prefix .\ui run build
```
