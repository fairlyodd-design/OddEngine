v10.35.5_SystemRuntimeStabilityAndImportAuditPass

What this pass is for
- lock down known runtime blockers before more panel expansion
- add a repeatable import/export audit you can run locally
- keep the Coinstore BTC/USDT futures panel from crashing on missing or unstable chart helpers
- keep the Plugins panel on a clean JSX-safe base

Files in this overlay
- package.json
- ui/package.json
- scripts/system-runtime-import-audit.mjs
- RUN_OS_IMPORT_AUDIT.bat
- ui/src/panels/Plugins.tsx
- ui/src/panels/CoinstoreBTCUSDTFutures.tsx
- ui/src/lib/coinstoreFuturesRuntime.ts

What changed
1) Added local audit scripts
- npm run audit:imports
- npm run audit:runtime
- RUN_OS_IMPORT_AUDIT.bat

2) Added a safe runtime helper for Coinstore futures
- buildHeikinAshiSvg
- buildPhoenixCoach
- avoids the old Heikin Ashi initialization crash path

3) Reset Plugins.tsx to a clean stable JSX structure

Install
- unzip over your OddEngine root
- overwrite when prompted
- run npm install if needed
- run RUN_OS_IMPORT_AUDIT.bat or npm run audit:runtime
- restart the app

Truth
- this pass focuses on runtime/import stability and the known crash lanes
- it is not a claim that every single panel in the repo is perfect
- it gives you a cleaner known-good base and a repeatable audit command for future sweeps
