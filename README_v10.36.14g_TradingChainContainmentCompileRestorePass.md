# v10.36.14g — Trading Chain Containment Compile Restore Pass

This is a surgical recovery pass for the failed v10.36.14 → 14f chain containment attempts.

## Why this exists

The earlier Trading chain containment patch partially inserted table containment references, but failed to insert every TypeScript definition. Later hotfixes kept trying to add AbortSignal support and failed validation against the live, drifted `Trading.tsx` shape.

This pass stops fighting the abort-signal anchor and restores compile safety directly.

## What it does

- Defines `TRADING_DRAWER_ROW_LIMIT`.
- Defines `TRADING_CONTRACT_ROW_LIMIT`.
- Defines `TRADING_CONTRACT_ISLAND_HEIGHT`.
- Defines `containedVisibleContracts` from `deferredVisibleContracts.slice(0, TRADING_CONTRACT_ROW_LIMIT)`.
- Ensures the contracts table maps `containedVisibleContracts` instead of the full deferred list.
- Removes broken `abortController` / `chainAbortRef` fragments from earlier failed attempts.
- Keeps the existing `scanRequestRef` request-id stale-response protection.
- Creates a backup of `ui/src/panels/Trading.tsx` before writing.

## What it does not touch

- CardGODMode
- Home
- Writers
- Studio
- global layout
- drag/drop
- CI workflow
- package scripts

## Apply

From `C:\OddEngine`:

```powershell
.\APPLY_v10.36.14g_TradingChainContainmentCompileRestorePass.bat
.\RUN_v10.36.14g_TRADING_CHAIN_CHECK.bat
```

## Commit after passing

```powershell
git status
git add ui/src/panels/Trading.tsx scripts/apply-trading-chain-containment-compile-restore-v10.36.14g.mjs README_v10.36.14g_TradingChainContainmentCompileRestorePass.md PATCH_NOTES_v10.36.14g.md docs/TRADING_CHAIN_CONTAINMENT_COMPILE_RESTORE_v10.36.14g.md APPLY_v10.36.14g_TradingChainContainmentCompileRestorePass.bat APPLY_v10.36.14g_TradingChainContainmentCompileRestorePass.ps1 RUN_v10.36.14g_TRADING_CHAIN_CHECK.bat
git commit -m "v10.36.14g Trading chain containment compile restore"
git tag v10.36.14g-clean
git push origin main
git push origin v10.36.14g-clean
```
