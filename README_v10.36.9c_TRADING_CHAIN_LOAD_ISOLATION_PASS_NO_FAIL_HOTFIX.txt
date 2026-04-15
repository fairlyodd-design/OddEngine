v10.36.9c_TradingChainLoadIsolationPass_NoFailHotfix

What this hotfix does
- stops using brittle exact-anchor patching
- patches Trading.tsx opportunistically with no-fail literal replacements
- adds deferred displayChain usage where exact lines still match
- adds selected-contract auto-recovery after chain refresh
- can show a contained chain refresh card in the source lane

If the script reports 0 changes
- your local Trading.tsx has drifted too far from the repo shape
- safest fallback:
  git checkout origin/main -- ui/src/panels/Trading.tsx

Run
- unzip over C:\OddEngine
- run RUN_v10.36.9c_TradingChainLoadIsolationPass_NoFailHotfix.bat
