# Home merge guide for v10.24.83_OSCompletionSweep

This guide adds an OS completion/onboarding board to `ui/src/panels/Home.tsx`.

## 1) Add imports
Add:

```ts
import {
  buildOSCompletionSummary,
  buildOnboardingBoard,
  type OSCompletionSummary,
} from "../lib/osCompletion";
import { loadConnectionsCenter } from "../lib/connectionsCenter";
```

If `connectionsCenter.ts` is not yet wired, you can stub with an empty object until that pass is merged.

## 2) Build the summary in Home
Add near the top of the component:

```ts
const connections = loadConnectionsCenter ? loadConnectionsCenter() : {};
const osCompletion = useMemo<OSCompletionSummary>(
  () => buildOSCompletionSummary(connections),
  [connections]
);
const onboardingBoard = useMemo(
  () => buildOnboardingBoard(osCompletion),
  [osCompletion]
);
```

## 3) Add a new OS Setup Health card
Recommended placement: high in the Home panel, above or near the top dashboard cards.

Suggested fields:
- Overall readiness %
- Ready panels count
- Partial panels count
- Missing panels count
- Missing required connections
- Next best setup step

## 4) Add a Completion Board card
Show:
- Ready
- Needs setup
- Missing critical inputs
- Suggested next actions

## 5) Add a Missing Connections card
Show grouped by panel:
- Studio
- Grocery
- Trading
- Calendar
- Money
- Entertainment
- Security/Cameras

## 6) Keep it read-only
Home should summarize and guide.
Preferences remains the place to edit/store secrets and provider inputs.
