# v10.26.12j — Trading mounted sections pass

This pass remounts the Trading panel into steadier full-width lanes so chart loading, source controls, drawer state, contracts, and plan/ticket work no longer fight the same outer layout row.

## What changed
- Added a mounted lane jump bar near the top of Trading.
- Promoted key areas into separate full-width mounted sections:
  - chart
  - source / expiration flow
  - scanner snapshot
  - contract drawer
  - strike / premium and OI charts
  - contracts table
  - watchlist
  - workbench / ticket / plan
- Added dedicated mounted-lane styling and a stable workbench grid.
- Kept the full-width chart treatment from 12i.
- Cleaned the synthetic Trading source so helper duplication no longer pollutes nested components.

## Goal
Reduce chain-load reflow and make Trading feel closer to Calendar's full-width board behavior, with clearer section ownership and easier jump navigation.
