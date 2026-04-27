@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.38.10 Homie Check-In Memory + Mood Ledger...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\apply_v10.38.10_HomieCheckInMemoryAndMoodLedgerPass.ps1"
if errorlevel 1 (
  echo.
  echo [OddEngine] Apply failed.
  pause
  exit /b 1
)
echo.
echo [OddEngine] Apply complete. Now run:
echo   npm --prefix ui run build
echo   npm run dev:desktop
pause
