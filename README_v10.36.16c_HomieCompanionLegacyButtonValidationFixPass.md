# v10.36.16c Homie Companion Legacy Button Validation Fix Pass

Surgical repair for v10.36.16b. The 16b pass applied the natural check-in / legacy-memory brain, but failed hard validation because the Legacy note JSX button was not inserted even though the patcher thought the quick-button block was already present.

## Run

```powershell
.\APPLY_v10.36.16c_HomieCompanionLegacyButtonValidationFixPass.bat
.\RUN_v10.36.16c_HOMIE_COMPANION_CHECK.bat
```

## Scope

Only touches:

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/styles.css`
- this patch script/docs

Does not touch Trading, CardGODMode, Home, Writers, Studio, drag/drop, CI workflow, or package scripts.
