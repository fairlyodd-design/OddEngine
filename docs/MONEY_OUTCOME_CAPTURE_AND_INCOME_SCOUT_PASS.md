# v10.26.12f — Money Outcome Capture + Income Scout Pass

## Goal
Turn Money Autopilot from estimated-only learning into a system that can capture real dollars made or saved, while adding a legit work-from-home scout layer across the FairlyOdd OS.

## What changed
- Added optional actual-dollar outcome capture when completing Money Autopilot moves.
- Added `moneyOutcomeCapture` prompt helper so Done can log real results without forcing extra steps every time.
- Extended money feedback records to track whether a result was estimated or actual.
- Added actual-log summary metrics to the Money Score feedback layer.
- Added Income Scout ranking across:
  - Games
  - Surveys / user-testing style filler lanes
  - Writing / eBooks
  - Apps
  - GPTs
  - Templates
  - Affiliate content
  - Mining
  - Trading
  - Budget / savings
- Fed Income Scout ideas into Money Vacuum so Autopilot can route more legit work-from-home paths.
- Surfaced Income Scout in Money, Brain, and Home.
- Upgraded Trading, Family Budget, Mining, and Game Time money strips so Done can capture real results.

## Main files
- `ui/src/lib/incomeScout.ts`
- `ui/src/lib/moneyOutcomeCapture.ts`
- `ui/src/lib/moneyScore.ts`
- `ui/src/lib/moneyAutopilot.ts`
- `ui/src/lib/moneyVacuum.ts`
- `ui/src/lib/brain.ts`
- `ui/src/panels/Money.tsx`
- `ui/src/panels/Brain.tsx`
- `ui/src/panels/Home.tsx`
- `ui/src/panels/Trading.tsx`
- `ui/src/panels/FamilyBudget.tsx`
- `ui/src/panels/Mining.tsx`
- `ui/src/panels/CryptoGames.tsx`

## Validation
- Targeted esbuild syntax/bundle checks passed on all touched files.
- Full project TypeScript still stops on the existing unrelated `Plugins.tsx` JSX errors in this source tree.
