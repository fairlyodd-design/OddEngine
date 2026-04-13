v10.35.4b_OSRuntimeTwoErrorHotfix

Fixes included:
1. Plugins panel TSX compile/runtime parse issue
2. Coinstore BTC/USDT futures missing exports in ui/src/lib/coinstoreFutures.ts

Install:
- unzip over OddEngine root
- overwrite files
- restart Vite / desktop app

Changed files:
- ui/src/panels/Plugins.tsx
- ui/src/lib/coinstoreFutures.ts

Notes:
- Plugins panel was rebuilt into a clean, valid TSX layout so the adjacent-JSX parse error is removed.
- Coinstore futures helper now exports buildHeikinAshiSvg and buildPhoenixCoach so the futures panel can render again.
