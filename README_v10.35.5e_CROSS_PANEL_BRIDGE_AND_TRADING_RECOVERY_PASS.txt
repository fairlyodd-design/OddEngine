v10.35.5e_CrossPanelBridgeAndTradingRecoveryPass

What this pass targets:
- shared AI/Homie type drift
- grocery budget compatibility bridge
- prefs / layout / notifications cleanup
- Cannabis / Crypto Games / Entertainment / Home / News / Preferences panel type fixes
- Trading panel cleanup of duplicated helper garbage causing the 90-error block
- stricter audit quarantine for known non-runtime debris

Changed files:
- ui/src/components/AssistantDock.tsx
- ui/src/components/CardGODMode.tsx
- ui/src/components/Homie3DActorShell.tsx
- ui/src/components/HomieBuddy.tsx
- ui/src/lib/groceryBudgetBridge.ts
- ui/src/lib/homieActionRouter.ts
- ui/src/lib/homieMemory.ts
- ui/src/lib/homieVoiceBridge.ts
- ui/src/lib/moneyOutcomeCapture.ts
- ui/src/lib/plugins.ts
- ui/src/lib/publicApi.ts
- ui/src/lib/publisherEngine.ts
- ui/src/lib/studioDesktopActions.ts
- ui/src/lib/writersShip.ts
- ui/src/panels/Cannabis.tsx
- ui/src/panels/CryptoGames.tsx
- ui/src/panels/Entertainment.tsx
- ui/src/panels/Home.tsx
- ui/src/panels/News.tsx
- ui/src/panels/Preferences.tsx
- ui/src/panels/Trading.tsx
- ui/tsconfig.audit.json

Notes:
- Trading.tsx was surgically cleaned to remove duplicated helper blocks that were injected into nested components and table row closures.
- This pass focuses on reducing the surviving repeated audit clusters before any deeper feature work.
