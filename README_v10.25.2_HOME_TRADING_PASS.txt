v10.25.2_HomeMissionControlPass + TradingExecutionAndJournalPass

Included:
- Home panel upgrades
  - Best Next Move card
  - Quick launch row (Trading, Poker, Grocery Meals, Studio)
  - System + money snapshot card
  - Activity timeline label refresh
  - Money snapshot reads Trading journal + Poker bankroll + Grocery basket/coupon stats
- Trading panel upgrades
  - Execution + Journal lane
  - P/L tracking
  - What worked / didn't work notes
  - Optional screenshot/chart URL field
  - Alert hooks tied to score threshold + setup side
  - Home money event dispatch on journal changes
- Version label bumped to 10.25.2

Files changed:
- ui/src/panels/Home.tsx
- ui/src/panels/Trading.tsx
- ui/src/styles.css
- ui/src/lib/version.ts

Notes:
- Nested Grocery cells remain intentionally non-draggable after the drag scope lock hotfix.
- If you want movable/reorderable meal cells later, that should be a separate internal panel interaction system with explicit handles, not the OS-level panel drag system.
