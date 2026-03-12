# Preferences merge guide for v10.24.83_OSCompletionSweep

This guide adds setup coverage + OS completion visibility to `ui/src/panels/Preferences.tsx`.

## 1) Add imports
Add:

```ts
import {
  buildOSCompletionSummary,
  summarizeConnectionsByPanel,
} from "../lib/osCompletion";
import { loadConnectionsCenter } from "../lib/connectionsCenter";
```

## 2) Build the summary in Preferences
Add near the top of the component:

```ts
const connections = loadConnectionsCenter ? loadConnectionsCenter() : {};
const osCompletion = useMemo(
  () => buildOSCompletionSummary(connections),
  [connections]
);
const panelCoverage = useMemo(
  () => summarizeConnectionsByPanel(connections),
  [connections]
);
```

## 3) Add a Setup Coverage card
Show:
- overall readiness %
- ready / partial / missing panel counts
- total configured connections
- total required inputs still missing

## 4) Add a Panel Coverage table/list
For each panel:
- panel name
- readiness %
- status (Ready / Partial / Missing)
- missing keys

## 5) Keep Preferences as the edit hub
Do not move secret editing out of Preferences.
This pass only adds stronger visibility and completion reporting.
