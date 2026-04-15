v10.36.9b Trading Chain Load Isolation Hotfix

What this fixes:
- removes the brittle exact-text anchors from the first v10.36.9 patch
- injects chain-load isolation using regex-based anchors
- preserves last-good chain while refresh is running
- keeps chart and drawer mounted more calmly during symbol/expiration refresh
- auto-refocuses a best contract after refresh if the old selection disappears

Install:
1. unzip over C:\OddEngine
2. run RUN_v10.36.9b_TradingChainLoadIsolationPass_Hotfix.bat
3. restart OddEngine
