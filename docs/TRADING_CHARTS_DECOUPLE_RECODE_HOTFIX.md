# v10.26.10a Trading Charts Decouple Recode Hotfix

This hotfix decouples the Trading charts and contract table from the full loaded chain.

## What changed
- Option curve now renders from a smaller chart contract window instead of the full chain.
- OI bars now render from the same smaller chart contract window.
- Contracts table now uses a 40-row visible window with Prev/Next controls.
- Selected contract stays eligible even when outside the current visible window.
- Contract window resets on symbol / expiry / filter changes.

## Goal
Reduce redraw pressure and UI twitch when large chains load or filters change.
