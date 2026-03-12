# Preferences merge guide for v10.24.82

## Goal
Turn Preferences into the OS-level setup hub for usernames, passwords, API keys,
tokens, account IDs, webhook URLs, and provider-specific settings.

## 1) Import the helper

```ts
import {
  CONNECTION_SERVICES,
  loadConnectionsCenter,
  saveConnectionsCenter,
  upsertConnection,
  markConnectionTestResult,
  getConnection,
  getValue,
  summarizeAllPanelStatuses,
} from "../lib/panelConnections";
```

## 2) Add local state

```ts
const [connections, setConnections] = useState(() => loadConnectionsCenter());
const [panelStatuses, setPanelStatuses] = useState(() => summarizeAllPanelStatuses(connections));
```

## 3) Keep statuses in sync

```ts
useEffect(() => {
  saveConnectionsCenter(connections);
  setPanelStatuses(summarizeAllPanelStatuses(connections));
}, [connections]);
```

## 4) Render a Connections / Secrets Center section

Create one section that:
- loops through `CONNECTION_SERVICES`
- renders fields for each service
- updates values via `upsertConnection(...)`
- has a `Test Connection` button that calls a stub or real tester
- stores `lastTestOk` / `lastTestedAt` via `markConnectionTestResult(...)`

## 5) Add an OS setup summary card

Use `panelStatuses` to show which panels are:
- ready
- partially configured
- missing required inputs

## Security note
Keep secrets local only. Do not commit real values to GitHub.
