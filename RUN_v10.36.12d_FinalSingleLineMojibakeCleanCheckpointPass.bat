@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.12d Final Single-Line Mojibake Clean Checkpoint
echo -----------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.12d_FinalSingleLineMojibakeCleanCheckpointPass.ps1"
if errorlevel 1 (
  echo.
  echo v10.36.12d cleanup/audit pass found issues. See checkpoints folder for the report.
) else (
  echo.
  echo v10.36.12d cleanup/audit pass passed. Clean checkpoint ready.
)
echo.
pause
