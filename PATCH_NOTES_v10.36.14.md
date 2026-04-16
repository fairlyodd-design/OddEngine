# PATCH NOTES — v10.36.14 TradingChainContainmentAndVirtualizedRowsPass

## Goal
Stop options-chain loading from destabilizing the Trading panel and outer OS layout.

## Fixes

1. **Stable contract render island**
   - Contract table is now fixed at 520px high.
   - Internal scrolling is contained with `overscrollBehavior: contain` and CSS containment.

2. **Rendered-row cap**
   - Full filtered contract count is preserved.
   - Only the first 120 rows render at once.
   - A notice appears when more rows are hidden behind filters.

3. **Loading does not collapse layout**
   - Loading state now shows inside the contract section without changing the table island height.

4. **Website-mode abort support**
   - New browser chain scans abort older browser website-mode requests when possible.
   - Desktop bridge/API mode still uses request IDs to ignore late responses.

5. **No global layout touch**
   - No CardGODMode, router, Home, Writers, Studio, or drag/drop files changed.
