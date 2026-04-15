@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.12e2 Build Warning Native-Stderr Hotfix Clean Checkpoint
echo --------------------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.12e2_BuildWarningNativeStderrHotfixCleanCheckpointPass.ps1"
set CODE=%ERRORLEVEL%
if "%CODE%"=="0" (
  echo.
  echo v10.36.12e2 checkpoint PASSED.
) else (
  echo.
  echo v10.36.12e2 checkpoint found issues. See checkpoints folder for the report.
)
echo.
pause
exit /b %CODE%
