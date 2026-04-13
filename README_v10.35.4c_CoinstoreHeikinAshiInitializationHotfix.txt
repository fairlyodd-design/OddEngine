v10.35.4c_CoinstoreHeikinAshiInitializationHotfix

What this fixes:
- Coinstore BTC/USDT futures panel crash: "Cannot access 'ha' before initialization"
- Restores a stable buildHeikinAshiSvg implementation
- Keeps buildPhoenixCoach exported so the panel render path stays intact

Files changed:
- ui/src/lib/coinstoreFutures.ts

Install:
- unzip over OddEngine root
- overwrite files
- restart Vite / desktop app

Notes:
- The Electron Content-Security-Policy warning shown in dev tools is a development warning, not the crash cause.
- This hotfix only targets the Coinstore futures runtime blocker.
