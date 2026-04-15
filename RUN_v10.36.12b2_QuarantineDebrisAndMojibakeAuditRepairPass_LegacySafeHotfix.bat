@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.12b2_QuarantineDebrisAndMojibakeAuditRepairPass_LegacySafeHotfix.ps1"
endlocal
