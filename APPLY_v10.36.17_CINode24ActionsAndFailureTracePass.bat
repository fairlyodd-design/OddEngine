@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.36.17 CI Node24 Actions and Failure Trace Pass
node scripts\apply-ci-node24-actions-v10.36.17.mjs
if errorlevel 1 (
  echo.
  echo [OddEngine] v10.36.17 apply FAILED. Paste the output back to Homie.
  pause
  exit /b 1
)
echo.
echo [OddEngine] v10.36.17 apply complete.
pause
