v10.36.12b_QuarantineDebrisAndMojibakeAuditRepairPass

Purpose
- Clean the issues found by v10.36.12 before creating a clean checkpoint.
- Quarantine duplicate nested source trees.
- Quarantine patch debris under ui/src.
- Repair common mojibake text in key shell/panel files.
- Re-run audit/build and write a report.

Use
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.12b_QuarantineDebrisAndMojibakeAuditRepairPass.bat
3. Paste the result back into ChatGPT.

Notes
- This pass quarantines instead of deleting.
- Quarantined files go under checkpoints/v10.36.12b_.../quarantine.
- If audit/build pass, re-run v10.36.12 to create the clean checkpoint/tag.
