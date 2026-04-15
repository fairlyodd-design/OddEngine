v10.36.8_RuntimeLazyImportRecoveryAndTradingStabilityPass

Goal
- reduce transient lazy-import / Vite panel fetch failures
- prewarm the most-used panels so Home / Trading / Homie / Brain / Money / Calendar are less likely to red-screen on first open
- reduce Trading fragility by keeping the last good chain visible during reload failure and isolating heavy chart widgets behind soft section guards

Included
- ui/src/lib/lazyWithRetry.ts
- ui/src/components/SoftErrorGuard.tsx
- PATCH_v10.36.8_RuntimeLazyImportRecoveryAndTradingStabilityPass.ps1
- RUN_v10.36.8_RuntimeLazyImportRecoveryAndTradingStabilityPass.bat

Install
1. unzip over C:\OddEngine
2. run RUN_v10.36.8_RuntimeLazyImportRecoveryAndTradingStabilityPass.bat
3. restart OddEngine

Important truth
- this is a runtime recovery + Trading stabilization pass
- it reduces transient chunk-fetch failures; it does not claim every future runtime crash is impossible
- it patches App.tsx and Trading.tsx in place so your newer local shell work is preserved
