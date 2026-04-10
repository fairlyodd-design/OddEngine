# v10.26.12e — Money Score Feedback Loop Pass

## Goal
Turn Money Autopilot from a persistent queue into a real feedback loop. Completed moves should feed back into future rankings so the OS starts leaning harder into the panels and money lanes that actually produce.

## What changed
- Added `ui/src/lib/moneyScore.ts`
  - Stores scored money outcomes in local storage
  - Tracks wins / mixed / losses
  - Builds scorecards for top panels and top lanes
  - Provides learning boosts that can be applied to future move ranking
- Updated `ui/src/lib/moneyVacuum.ts`
  - Applies learned score and confidence boosts to ranked money moves
  - Annotates moves with `learning` metadata so UI can show why they are being boosted or dragged down
- Updated `ui/src/lib/moneyAutopilot.ts`
  - Added `completeMoneyAutopilotMove()` helper
  - Completing a move now records money feedback automatically before moving the item into the completed bucket
- Updated Brain + Money panels
  - Added Money Score Feedback Loop cards
  - Added top panels, top lanes, and recent score history UI
  - Added learning badges to ranked money cards
- Updated Trading / Family Budget / Mining / Game Time
  - Their inline Money Autopilot strips now record feedback when a move is marked done
  - Added small learning badges so it is obvious when a lane is being boosted by past wins

## Behavior notes
- "Done" currently records a positive outcome by default
- Skip / snooze do not count as negative feedback
- Estimated dollar values are used when a move does not yet have a manually logged real value
- Learning is local-first and stored in browser local storage

## Why this matters
This pass turns the money layer from static scoring into a lightweight learning loop. The OS can now start preferring the money lanes that are repeatedly producing instead of ranking each scan as if history never happened.
