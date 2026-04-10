OddEngine v10.25.0 Safe Baseline Merge

This package was built by merging the user-provided working zips:
- v10.24.3_SnapAndWorkspacePass_FULL_DROPIN
- v10.24.4_TradingLaneIsolationAndPerformancePass_FULL_DROPIN
- v10.24.4_TradingLayoutGlitchHotfix_OVERLAY

Applied files:
- ui/src/panels/Trading.tsx
- ui/src/styles.css
- ui/src/components/CardGODMode.tsx
- ui/src/lib/version.ts

Scope:
- Snap + magnet drag system and workspace memory from v10.24.3 base
- Trading lane isolation/perf pass from v10.24.4
- Trading layout glitch hotfix CardGODMode overlay
- Version label bumped to 10.25.0

Important honesty note:
This is a safe integrated baseline zip, not the previously described full OmniPanel feature sweep. I kept the merge intentionally surgical to avoid regressions and to give you a real working package from the actual uploaded codebase.
