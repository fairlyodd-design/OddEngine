@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.36.15 Homie Companion Life Coach and Voice Presence Pass
node scripts\apply-homie-companion-life-coach-v10.36.15.mjs
if errorlevel 1 (
  echo.
  echo [OddEngine] v10.36.15 apply FAILED. Paste the output back to Homie.
  pause
  exit /b 1
)
echo.
echo [OddEngine] v10.36.15 apply complete.
pause
