# v10.36.12_RuntimeAuditAndCleanCheckpointPass

This is a checkpoint/doctor pass, not a visual patch.

## What it does

- Locates the OddEngine root safely.
- Runs the existing repo runtime audit:
  - `npm run audit:runtime`
- Runs the UI build check:
  - `npm run build:web`
- Checks the recently sensitive files:
  - `ui/src/App.tsx`
  - `ui/src/styles.css`
  - `ui/src/panels/Home.tsx`
  - `ui/src/panels/Trading.tsx`
  - `ui/src/components/ActivityRail.tsx`
- Writes a checkpoint report into:
  - `checkpoints/v10.36.12_RuntimeAuditAndCleanCheckpointPass_<timestamp>/`
- If audit/build pass and the git working tree is clean, creates a local tag:
  - `v10.36.12-clean`

## How to use

1. Unzip this over `C:\OddEngine`.
2. Run:

   `RUN_v10.36.12_RuntimeAuditAndCleanCheckpointPass.bat`

3. Read the report in the `checkpoints` folder.
4. If it passes, restart OddEngine.

## Can I delete this after running?

Yes.

After the pass runs, you can delete:

- this zip
- `RUN_v10.36.12_RuntimeAuditAndCleanCheckpointPass.bat`
- `scripts/oddengine-runtime-clean-checkpoint-v10.36.12.mjs`
- this README

The generated report stays in `checkpoints/`.
