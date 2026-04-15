@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.12b Quarantine Debris and Mojibake Audit Repair
echo ---------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.12b_QuarantineDebrisAndMojibakeAuditRepairPass.ps1"
set EXITCODE=%ERRORLEVEL%
echo.
if "%EXITCODE%"=="0" (
  echo v10.36.12b cleanup/audit pass completed.
) else (
  echo v10.36.12b cleanup/audit pass found issues. See checkpoints folder for the report.
)
echo.
pause
exit /b %EXITCODE%
