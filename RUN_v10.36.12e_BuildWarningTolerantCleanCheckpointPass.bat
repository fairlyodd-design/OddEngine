@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.12e Build-Warning-Tolerant Clean Checkpoint Pass
echo ----------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.12e_BuildWarningTolerantCleanCheckpointPass.ps1"
set EXITCODE=%ERRORLEVEL%
if "%EXITCODE%"=="0" (
  echo.
  echo v10.36.12e clean checkpoint passed.
) else (
  echo.
  echo v10.36.12e checkpoint found issues. See checkpoints folder for the report.
)
echo.
pause
exit /b %EXITCODE%
