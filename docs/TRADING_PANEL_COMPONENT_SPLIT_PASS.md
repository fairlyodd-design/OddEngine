# v10.26.10c Trading Panel Component Split Pass

This pass begins the Trading panel component split so the heavy render tree is not concentrated in one monster file.

Split out components:
- trading/TradingCharts.tsx
- trading/TradingDrawer.tsx
- trading/TradingContractsTable.tsx

Updated:
- ui/src/panels/Trading.tsx
- ui/src/lib/version.ts
- ui/package.json
- package.json
- .oddengine_last_ui_version.txt
