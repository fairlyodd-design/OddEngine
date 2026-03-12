# Other panel wiring guide for v10.24.82

Suggested panel IDs already included in `panelConnections.ts`:
- Trading
- Calendar
- Money
- Entertainment

Pattern:

```ts
const setup = useMemo(() => buildPanelConnectionStatus("<PanelId>"), []);
```

Render:

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">SETUP STATUS</div>
  <div className="small mt-2"><b>Status:</b> {setup.ready ? "Ready" : "Needs setup"}</div>
  <div className="small mt-2"><b>Completion:</b> {setup.completionPercent}%</div>
  <div className="small mt-2"><b>Missing:</b> {buildMissingInputsLabel(setup)}</div>
</div>
```
