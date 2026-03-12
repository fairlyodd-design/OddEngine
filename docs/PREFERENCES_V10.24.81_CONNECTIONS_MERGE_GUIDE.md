# Preferences / Connections Center merge guide for v10.24.81

This pass uses the existing **Preferences** seam as the OS-level setup place so all panel inputs can live in one proper setup hub.

## Files added by the pack
- `ui/src/lib/connectionsCenter.ts`

## Why Preferences
`App.tsx` already routes a dedicated Preferences panel in the broader FairlyOdd OS shell, so the safest place for usernames, passwords, API keys, tokens, and provider settings is the existing Preferences workspace instead of inventing a new routed panel.

## What to wire into `ui/src/panels/Preferences.tsx`

### 1) Add import
```ts
import {
  CONNECTION_SERVICES,
  buildConnectionsMarkdown,
  buildConnectionsSummary,
  loadConnections,
  saveConnections,
  updateConnectionValues,
  maskSecret,
  type SavedConnections,
} from "../lib/connectionsCenter";
```

### 2) Add local state
```ts
const [connections, setConnections] = useState<SavedConnections>(() => loadConnections());
const [showSecrets, setShowSecrets] = useState(false);
const [activeConnectionId, setActiveConnectionId] = useState<string>(CONNECTION_SERVICES[0]?.id || "");
const [connectionsCopied, setConnectionsCopied] = useState(false);
```

### 3) Persist changes
```ts
useEffect(() => {
  saveConnections(connections);
}, [connections]);
```

### 4) Add derived summary
```ts
const connectionSummary = useMemo(
  () => buildConnectionsSummary(connections),
  [connections]
);

const activeConnection = connectionSummary.find((item) => item.service.id === activeConnectionId) || connectionSummary[0] || null;
```

### 5) Add a new Preferences card / section
Use a card titled:
- `Connections & Secrets Center`

Recommended UX:
- left rail: service list with completion badges
- main area: editable fields for the selected service
- top actions:
  - show / hide secrets
  - copy markdown summary

### 6) Field rendering pattern
```tsx
{activeConnection?.service.fields.map((field) => {
  const raw = String(activeConnection.values[field.key] || "");
  const visible = field.secret && !showSecrets ? maskSecret(raw) : raw;

  return (
    <label key={field.key} className="small" style={{ display: "grid", gap: 6 }}>
      {field.label}
      <input
        className="input"
        type={field.secret && !showSecrets ? "password" : "text"}
        value={raw}
        placeholder={field.placeholder || ""}
        onChange={(e) =>
          setConnections((prev) =>
            updateConnectionValues(prev, activeConnection.service.id, {
              [field.key]: e.target.value,
            })
          )
        }
      />
      <span className="small">
        {field.required ? "Required" : "Optional"} · {field.secret ? "Secret" : "Visible"}
      </span>
    </label>
  );
})}
```

### 7) Copy markdown summary
```ts
const copyConnectionsSummary = async () => {
  await navigator.clipboard.writeText(buildConnectionsMarkdown(connections));
  setConnectionsCopied(true);
  window.setTimeout(() => setConnectionsCopied(false), 1600);
};
```

## Recommended services included in this pack
- Studio Render Providers
- Studio External Video Tools
- Grocery Providers
- Trading / Broker Integrations
- Calendar and Scheduling
- Money / Budget Providers
- Entertainment Accounts

## Safety note
Use local-only saved settings. Do **not** commit real secrets into repo files.
