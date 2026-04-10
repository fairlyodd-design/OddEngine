# v10.26.12r — Homie Live Voice + Action Router + Income Forge + Relationship Memory

This combined pass rolls the `12o` → `12r` direction into one integrated upgrade.

## What changed

### 1) Homie Live Voice Operator
- Homie buddy now supports a shell-level **continuous voice loop** toggle.
- Added **Read screen** behavior so Homie can speak a panel-aware summary of the current surface.
- Added voice actions from Embedded Homie Core:
  - Talk
  - Stop
  - Loop voice
  - Read screen
- Browser speech continues to route through the existing voice stack and announcements.

### 2) Homie Action Router
- Added a lightweight router for practical phrases such as:
  - `Homie open Trading`
  - `Homie what makes money today`
  - `Homie walk me through the next step`
  - `Homie pin the next move`
  - `Homie launch the right board`
  - `Homie ship one thing today`
- Router can:
  - open panels
  - jump to the best current money panel
  - queue a move when the move has a runnable action id
  - route into Homie with a seeded prompt for tiny-step guidance
  - trigger screen-read voice summaries

### 3) Phoenix Income Forge
- Added a recovery-aware sellable/ship layer that ranks lanes like:
  - KDP
  - Gumroad micro-offers
  - GPTs
  - template packs
  - affiliate content
  - micro-apps
- Added a **Ship one thing today** card and a **weekly income scoreboard** based on captured lane outcomes.
- Exposed the board in the Money panel and surfaced it on Home and Homie.

### 4) Homie Memory + Relationship
- Added a lightweight memory model that remembers:
  - current goals
  - recent Homie asks
  - favorite/repeated panels
  - current recovery mode
  - the strongest actual-paying lane from logged outcomes
- Embedded Homie Core and Homie now show a relationship-aware memory summary.

## Main files
- `ui/src/lib/homieMemory.ts`
- `ui/src/lib/incomeForge.ts`
- `ui/src/lib/homieActionRouter.ts`
- `ui/src/lib/homieCore.ts`
- `ui/src/lib/commandCenter.ts`
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/EmbeddedHomieCore.tsx`
- `ui/src/panels/Money.tsx`
- `ui/src/panels/Home.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/lib/prefs.ts`
- `ui/src/lib/version.ts`

## Validation notes
- This pass was applied to the latest synthetic source set available in this conversation.
- The repo still contains unrelated existing issues outside this pass, so whole-project build cleanliness was not claimed.
