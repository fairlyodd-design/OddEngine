# OddEngine Legacy Master Checklist

This is the human-readable version of the Legacy HQ board.

Seed statuses are **starting assumptions**, not a verified audit.

## Phase roadmap

### 0. System survival
Pass: `vLegacy.0_SystemSurvivalAndRecoveryPass`  
Goal: the family can launch the OS, recover it, and trust it.

### 1. Family front door
Pass: `vLegacy.1_FrontDoorHomeAndHomieGuidePass`  
Goal: anyone in the family can open the OS and know what to do next.

### 2. Homie legacy core
Pass: `vLegacy.2_HomieMemoryVoiceAndLegacyCorePass`  
Goal: Homie preserves your voice, guidance style, and family-specific context.

### 3. Legacy creation
Pass: `vLegacy.3_WritersLoungeLegacyCreationPass`  
Goal: the OS can turn memories, guidance, and stories into artifacts that last.

### 4. Daily family ops
Pass: `vLegacy.4_FamilyDailyOpsPass`  
Goal: the OS helps the family live day to day with less stress and less guessing.

### 5. Money and opportunity
Pass: `vLegacy.5_IncomeKnowledgeAndOpportunityPass`  
Goal: the OS preserves earning judgment and ranks the best next dollar move.

### 6. Maintainability
Pass: `vLegacy.6_MaintainabilityAndBuilderPass`  
Goal: a future helper can understand, repair, back up, and evolve the OS.

### 7. Presence and polish
Pass: `vLegacy.7_PresenceAndCreativePolishPass`  
Goal: the OS feels deeply alive without sacrificing honesty or stability.

## Core non-negotiables

- Core shell
- Panel registry
- Router and navigation
- Layout memory
- Startup and recovery
- Settings and state storage
- Home
- Homie typed reliability
- Writers Lounge text save/export
- Money and Family Budget integrity
- Builder as the maintenance nerve center

## Highest-risk seeded repair lanes

- Writers Lounge
- Writing Room
- Music Lab
- Render Lab
- Trading
- Homie presence

## Where the full structured board lives

Use `ui/src/lib/legacyChecklist.ts` and the in-app Builder panel for:
- per-panel acceptance criteria
- status editing
- export to Markdown / JSON / CSV / ZIP
