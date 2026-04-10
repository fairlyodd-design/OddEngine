# v10.26.11m Panel Context Isolation And Symbol Routing Hotfix

This pass focuses on the real workflow blockers seen in runtime review:

- stronger TradingView symbol normalization for ETF-heavy trading symbols like SCHD
- explicit source tags on the global Brain / Mission Control action queue
- a real Trading desk step lane: load chain -> focus contract -> build plan -> open ticket

## Important truth

The global coach / rail was intentionally kept global.
This pass does **not** hard-isolate the rail.
Instead it makes the queue source clearer with visible source tags so mixed global work stays understandable.

## Main files changed

- `ui/src/lib/publicApi.ts`
- `ui/src/lib/brain.ts`
- `ui/src/components/ActivityRail.tsx`
- `ui/src/panels/Brain.tsx`
- `ui/src/panels/Trading.tsx`
- `ui/src/lib/version.ts`
- package/version files

## What changed

### Symbol routing

`normalizePublicChartSymbol()` now knows more ETF / index / crypto routing cases and no longer defaults symbols like `SCHD` into the wrong exchange bucket as aggressively.

### Global queue source tags

The queue is still global by design, but Action Queue cards now show:

- `Global queue`
- `Source • <Panel>`

That makes mixed desk work easier to read without fighting the intentional OS-wide rail behavior.

### Trading step machine

The Trading HUD wizard now tracks four steps:

1. Chain loaded
2. Contract focused
3. Plan fresh
4. Ticket staged

The wizard buttons now drive the flow in sequence and will automatically fill missing earlier steps when possible.
