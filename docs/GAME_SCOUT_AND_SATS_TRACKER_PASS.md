# v10.26.11o — Game Scout + Sats Tracker Pass

## What this pass adds
- Fixes the root desktop launcher script mismatch by restoring a `dev:desktop` route.
- Points the root `dev` script at the real `scripts/dev-desktop.mjs` launcher.
- Adds a stronger Crypto Games / ZBD panel with:
  - ranked game scout board
  - sats-per-hour estimates
  - cooldown + readiness scoring
  - active session tracking
  - payout logging
  - daily sats target tracking
  - manual launch staging for best game
- Fixes the broken `scanOfficialZbd` wiring so the scan button can actually add games.

## Honest boundary
This pass helps discover, rank, open, and track games. It does not automate gameplay.
