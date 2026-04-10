# v10.26.12k — Recovery-Aware Income Sniper Board Pass

## What this pass adds

This pass turns the old Income Scout view into a more practical **Recovery-Aware Income Sniper Board**.

It is built to answer one question fast:

**What is the best legit, work-from-home money move I can do today with the energy and time I actually have?**

## Core upgrades

- Added a new `incomeSniper` library layer.
- Added a **Today’s Best Move** card in Money.
- Added sniper filters for:
  - `$0 upfront`
  - `Low energy`
  - `Low time`
  - `From home`
- Added **actual dollar outcome logging** per income lane.
- Added lane learning so repeated wins/losses change ranking.
- Updated Brain and Home to surface the new sniper board instead of the older scout-only view.

## New files

- `ui/src/lib/incomeSniper.ts`

## Updated files

- `ui/src/panels/Money.tsx`
- `ui/src/panels/Brain.tsx`
- `ui/src/panels/Home.tsx`
- `ui/src/lib/version.ts`
- `BUILD_NOTES.txt`

## How it works

The sniper board starts with the existing legit income lanes already being generated from FairlyOdd OS state:

- Games
- Surveys
- Writing / eBooks
- Apps
- GPTs
- Templates
- Affiliate
- Mining
- Trading
- Savings

Then it applies:

1. **Recovery fit** from the recovery planner
2. **Filter boosts** based on the current sniper toggles
3. **Actual outcome boosts** from logged dollars per lane

That means the board can stop acting like every lane is equally useful every day.

## Outcome logging

Every lane in Money’s sniper board now has a **Log outcome** button.

That lets you capture:

- actual dollars made or saved
- win / mixed / loss
- optional note

Those logs are stored locally and used to build the **Actual Dollars by Lane** card.

## Goal of this pass

Make FairlyOdd OS better at choosing:

- legit work-from-home lanes
- low-friction money moves
- realistic daily moves for rough health days
- lanes that have actually produced results before
