@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.37.3_HomiePopOutOwnershipRepairPass...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply_v10.37.3_HomiePopOutOwnershipRepairPass.ps1"
if errorlevel 1 (
  echo.
  echo [OddEngine] Apply failed.
  pause
  exit /b 1
)
echo.
echo [OddEngine] Apply complete. Now run:
echo npm --prefix ui run build
echo npm run dev:desktop
pause
