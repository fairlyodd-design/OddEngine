# v10.25.07 — Baseline Lock / Audit Truth Pass

This pass is intentionally a **safe overlay**, not a full repo replacement.

## Why this exists

Recent work added good new surfaces, but the project also drifted into pass-on-top-of-pass chaos:

- shell cleanups sometimes hid working panels
- generated zips sometimes carried fewer panels than the real local tree
- Trading, charts, and options were especially vulnerable because many finished rooms live outside the smallest packaged subset

This pass stops that pattern.

## What this pass does

- scans the real local repo under `C:\OddEngine`
- inventories every panel file in `ui/src/panels`
- checks which panels are imported and routed in `ui/src/App.tsx`
- checks which panel ids appear in `ui/src/lib/brain.ts`
- builds a markdown report and JSON manifests in `docs/generated`
- builds a focused Trading panel inventory so chart / options / strategy rooms can be protected before future cleanup work

## What this pass does *not* do

- does not rewrite your panels
- does not delete or hide panels
- does not try to “fix” Trading by guessing
- does not assume the last generated zip is the source of truth

## Success state

You are back on solid ground when:

1. the local audit report reflects your real `C:\OddEngine` tree
2. every expected panel shows up in the report
3. missing App routes and missing Brain references are visible in one place
4. Trading rooms you care about are explicitly listed and preserved
5. only after that do you do another feature pass

## Recommended order

1. Copy this overlay into `C:\OddEngine`
2. Run `RUN_BASELINE_AUDIT_WINDOWS.bat`
3. Read `docs/generated/baseline-lock-report.md`
4. Freeze the good baseline in Git
5. Only then plan the next feature pass
