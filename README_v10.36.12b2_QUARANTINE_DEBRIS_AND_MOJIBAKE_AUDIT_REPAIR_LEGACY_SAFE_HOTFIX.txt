# v10.36.12b2 Quarantine Debris and Mojibake Audit Repair Pass — Legacy Safe Hotfix

This hotfix replaces the failed v10.36.12b cleanup runner.

## Why it exists

The previous PowerShell script used:

`[System.IO.Path]::GetRelativePath`

That method is not available on older Windows PowerShell/.NET combinations, so the cleanup crashed before moving anything.

## What this does

- Avoids `.NET GetRelativePath` entirely.
- Uses a Node cleanup/audit script for path handling.
- Quarantines:
  - `ui/src/components/ui/src`
  - `PATCH*.ts` / `PATCH*.tsx` debris under `ui/src`
- Attempts safe mojibake repair in key files:
  - `ui/src/styles.css`
  - `ui/src/App.tsx`
  - `ui/src/panels/Home.tsx`
  - `ui/src/panels/Trading.tsx`
  - `ui/src/components/ActivityRail.tsx`
  - `ui/src/panels/Homie.tsx`
- Runs:
  - `npm run audit:runtime`
  - `npm run build:web`
- Writes a report and manifest under `checkpoints/`.

## Use

Unzip over `C:\OddEngine`, then run:

`RUN_v10.36.12b2_QuarantineDebrisAndMojibakeAuditRepairPass_LegacySafeHotfix.bat`

Paste the result back into ChatGPT.
