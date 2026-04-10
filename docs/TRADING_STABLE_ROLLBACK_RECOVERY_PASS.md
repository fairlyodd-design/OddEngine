# Trading Stable Rollback Recovery Pass

This recovery overlay restores the Trading panel source from the last known stable pre-sniper refactor baseline.

Purpose:
- stop the repeated Trading glitch regressions
- restore a calmer Trading panel
- remove the unstable layered penny-sniper rewrites from the panel source

What this does:
- replaces `ui/src/panels/Trading.tsx` with the stable baseline version

What this does not do:
- it does not preserve the later experimental penny-sniper UI changes
- those should be rebuilt later as isolated modules rather than layered into the main Trading panel
