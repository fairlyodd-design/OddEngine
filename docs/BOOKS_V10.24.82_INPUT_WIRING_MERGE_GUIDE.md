# Books / Studio merge guide for v10.24.82

## Goal
Let Studio read setup status from the Connections Center and show:
- setup ready / missing inputs
- completion percent
- shortcut to Preferences

## 1) Import

```ts
import { buildPanelConnectionStatus, buildMissingInputsLabel } from "../lib/panelConnections";
```

## 2) Add derived status

```ts
const studioSetup = useMemo(() => buildPanelConnectionStatus("Books"), []);
```

## 3) Add a setup card near the top of Studio

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">STUDIO SETUP</div>
  <div className="small mt-2">
    <b>Status:</b> {studioSetup.ready ? "Ready" : "Needs setup"}
  </div>
  <div className="small mt-2">
    <b>Completion:</b> {studioSetup.completionPercent}%
  </div>
  <div className="small mt-2">
    <b>Missing:</b> {buildMissingInputsLabel(studioSetup)}
  </div>
  <div className="note mt-3">
    Configure render base URL / provider inputs in Preferences → Connections Center.
  </div>
</div>
```

## 4) Optional
Disable render job creation when setup is not ready.
