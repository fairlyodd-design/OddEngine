@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo [OddEngine] v10.36.12 Runtime Audit and Clean Checkpoint Pass
echo ------------------------------------------------------------
echo Root: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found on PATH.
  echo Install Node or open this from the same terminal you use for OddEngine.
  echo.
  pause
  exit /b 1
)

node ".\scripts\oddengine-runtime-clean-checkpoint-v10.36.12.mjs"
set EXITCODE=%ERRORLEVEL%

echo.
if "%EXITCODE%"=="0" (
  echo v10.36.12 audit/checkpoint pass completed cleanly.
) else (
  echo v10.36.12 audit/checkpoint pass found issues. See checkpoints folder for the report.
)
echo.
echo Rebuild or restart OddEngine now if the audit passed.
pause
exit /b %EXITCODE%
