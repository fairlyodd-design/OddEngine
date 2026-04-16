@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.36.16c Homie Companion Legacy Button Validation Fix Pass
node scripts\apply-homie-companion-legacy-button-validation-fix-v10.36.16c.mjs
if errorlevel 1 (
  echo.
  echo [OddEngine] v10.36.16c apply FAILED. Paste the output back to Homie.
  pause
  exit /b 1
)
echo.
echo [OddEngine] v10.36.16c apply complete.
pause
