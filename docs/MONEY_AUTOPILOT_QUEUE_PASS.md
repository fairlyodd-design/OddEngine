# v10.26.12d Money Autopilot Queue Pass

## Goal
Turn Money Vacuum from a ranked scan into a persistent action queue that survives refreshes and tracks what was completed, snoozed, or skipped.

## What changed
- Added `ui/src/lib/moneyAutopilot.ts`
  - stable move fingerprints
  - persistent queue records in local storage
  - active / snoozed / completed / skipped buckets
  - per-panel next-money-move helper
- Brain Mission Control
  - new Money Autopilot queue section
  - best next dollar move card
  - run / complete / snooze / skip controls
  - snoozed lane and done / skipped history
  - quick actions to refresh or run the next autopilot move
- Money panel
  - dedicated Money Autopilot card above Money Vacuum
  - quick controls for next move and live queue
- Home panel
  - upgraded the Money card into a live Money Autopilot summary
- Cross-panel compact strips
  - Trading
  - Family Budget
  - Mining / BTC
  - Game Time

## Behavior notes
- Money Autopilot does not auto-trade or auto-spend.
- It ranks and routes the best next move using saved panel state.
- Completing, snoozing, and skipping survive rescans.
- Panels can surface their own top move without duplicating queue logic.

## Main files touched
- `ui/src/lib/moneyAutopilot.ts`
- `ui/src/lib/brain.ts`
- `ui/src/panels/Brain.tsx`
- `ui/src/panels/Money.tsx`
- `ui/src/panels/Home.tsx`
- `ui/src/panels/Trading.tsx`
- `ui/src/panels/FamilyBudget.tsx`
- `ui/src/panels/Mining.tsx`
- `ui/src/panels/CryptoGames.tsx`
- `ui/src/lib/version.ts`
