# Trading Chain Containment Compile Restore — v10.36.14g

This pass is designed for the state where `Trading.tsx` contains references such as:

- `TRADING_DRAWER_ROW_LIMIT`
- `TRADING_CONTRACT_ROW_LIMIT`
- `TRADING_CONTRACT_ISLAND_HEIGHT`
- `containedVisibleContracts`
- `abortController`
- `chainAbortRef`

…but not all definitions were successfully inserted.

The pass repairs the compile lane first, then lets the check script run:

1. runtime import audit
2. TypeScript audit lane
3. Vite production build

If the check passes, the next useful runtime test is opening Trading, scanning SPY/QQQ, and watching whether the contracts island remains contained during chain load.
