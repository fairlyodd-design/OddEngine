# HOMIE v10.24.90 Desktop Control Integration Guide

Use this helper to let Homie trigger safe desktop-style actions without rewriting the entire Homie panel.

## 1) Add import in `ui/src/panels/Homie.tsx`

```ts
import {
  getHomieDesktopActions,
  runHomieDesktopAction,
  type HomieDesktopAction,
  type HomieDesktopContext,
} from "../lib/homieDesktopControl";
```

## 2) Build a desktop context inside `Homie()`

```ts
const desktopContext: HomieDesktopContext = {
  activePanelId: currentPanelId,
  renderOutputPath: latestOutputPath,
  packetFolderPath: latestPacketFolder,
  onNavigate,
  bridge: {
    openPanel: async (panelId) => onNavigate?.(panelId),
    focusPanel: async (panelId) => onNavigate?.(panelId),
    copyText: async (text) => navigator.clipboard.writeText(text),
    openFolder: async (path) => oddApi?.openPath?.(path),
    revealFile: async (path) => oddApi?.revealInFolder?.(path),
    toggleMic: async () => setMicEnabled((v) => !v),
    toggleCamera: async () => setCameraEnabled((v) => !v),
  },
};
```

## 3) Create actions list

```ts
const desktopActions = useMemo(
  () => getHomieDesktopActions(desktopContext),
  [desktopContext.activePanelId, desktopContext.renderOutputPath, desktopContext.packetFolderPath]
);
```

## 4) Render a small control card

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">DESKTOP CONTROL</div>
  <div className="small mt-2">Homie can help open panels, reveal outputs, and control mic/camera.</div>
  <div className="row wrap mt-3" style={{ gap: 8 }}>
    {desktopActions.map((action) => (
      <button
        key={action.id}
        className={`tabBtn ${action.disabled ? "" : "active"}`}
        disabled={action.disabled}
        onClick={async () => {
          const result = await runHomieDesktopAction(action, desktopContext);
          setLastHomieActionMessage(result.message);
        }}
      >
        {action.label}
      </button>
    ))}
  </div>
</div>
```

## 5) Suggested desktop bridge methods

If your Electron bridge supports them later, wire these names:
- `oddApi.openPath(path)`
- `oddApi.revealInFolder(path)`

If they do not exist yet, keep the helpers as safe no-ops or use `navigator.clipboard` for copy-only actions.

## Notes
- Keep mic/camera off by default.
- Always show a visible indicator when camera or mic is active.
- Keep folder/file actions desktop-only where possible.
