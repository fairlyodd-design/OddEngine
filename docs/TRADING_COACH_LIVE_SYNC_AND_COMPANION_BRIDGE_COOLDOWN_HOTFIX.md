# v10.26.11p Trading Coach Live Sync And Companion Bridge Cooldown Hotfix

## What changed

- Trading Coach dock now refreshes when panel storage changes in the same window.
- Trading panel context summary now reads the live trading status snapshot, current step, and selected contract instead of staying stuck on the old mount-time read.
- Homie Companion bridge now backs off for 30 seconds after a failed localhost connection so devtools stop filling with repeated 127.0.0.1:45777 connection-refused noise when the separate companion app is offline.

## Main files

- `ui/src/lib/storage.ts`
- `ui/src/components/AssistantDock.tsx`
- `ui/src/lib/brain.ts`
- `ui/src/lib/homieCompanionBridge.ts`

## Honest note

This is a UI/state hotfix pass. It does not add a new market-data provider or a full desktop build verification.
