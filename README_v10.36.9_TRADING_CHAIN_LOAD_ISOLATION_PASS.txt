v10.36.9_TradingChainLoadIsolationPass

What this pass does
- keeps Trading visible while chain loads run
- shows a contained refresh card in the source lane instead of feeling like the whole panel is reloading
- keeps drawer and chart mounted by preferring last good chain data during refresh
- auto-selects a best contract after refresh if the old one disappears
- cancels stale scan results with the existing request id flow

Files
- PATCH_v10.36.9_TradingChainLoadIsolationPass.ps1
- RUN_v10.36.9_TradingChainLoadIsolationPass.bat
- README_v10.36.9_TRADING_CHAIN_LOAD_ISOLATION_PASS.txt

Use
1. unzip over C:\OddEngine
2. run RUN_v10.36.9_TradingChainLoadIsolationPass.bat
3. restart OddEngine
4. test Trading with scan symbol and expiration switching
