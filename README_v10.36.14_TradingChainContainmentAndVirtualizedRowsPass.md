# v10.36.14 — TradingChainContainmentAndVirtualizedRowsPass

This is a surgical Trading-only pass for the issue:

> Trading is stable until options chains load, then the UI starts jumping/flickering/going wild.

## What this pass changes

- Adds a fixed-height options-chain render island inside `Trading.tsx`.
- Caps rendered contract rows to the first 120 visible rows while preserving the full filtered count.
- Adds a stable loading line so loading a new chain does not collapse or resize the contract table area.
- Keeps the last good chain behavior already present in the panel.
- Adds browser-side abort support for website-mode chain loads.
- Keeps the existing request-id stale response guard.
- Leaves API mode guarded by request IDs even when the desktop bridge cannot abort the underlying request.
- Keeps drawer rows capped at 30 per side.
- Adds a root diagnostic marker: `data-trading-chain-containment="v10.36.14"`.

## Files touched

- `ui/src/panels/Trading.tsx`

## Files intentionally not touched

- CardGODMode
- Home
- Writers
- Studio
- CI workflow
- package scripts
- panel registry
- global layout/drag/drop

## Apply

Extract into `C:\OddEngine`, then run:

```powershell
.\APPLY_v10.36.14_TradingChainContainmentAndVirtualizedRowsPass.bat
.\RUN_v10.36.14_TRADING_CHAIN_CHECK.bat
```

## After it passes

```powershell
git status
git add ui/src/panels/Trading.tsx scripts/apply-trading-chain-containment-v10.36.14.mjs README_v10.36.14_TradingChainContainmentAndVirtualizedRowsPass.md PATCH_NOTES_v10.36.14.md docs/TRADING_CHAIN_CONTAINMENT_v10.36.14.md APPLY_v10.36.14_TradingChainContainmentAndVirtualizedRowsPass.bat APPLY_v10.36.14_TradingChainContainmentAndVirtualizedRowsPass.ps1 RUN_v10.36.14_TRADING_CHAIN_CHECK.bat
git commit -m "v10.36.14 Trading chain containment and virtualized rows"
git tag v10.36.14-clean
git push origin main
git push origin v10.36.14-clean
```
