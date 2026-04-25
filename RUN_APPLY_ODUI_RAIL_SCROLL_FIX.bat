@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.37.2_TrueRailScrollAndActionContainmentPass...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply_v10.37.2_TrueRailScrollAndActionContainmentPass.ps1"
if errorlevel 1 (
  echo.
  echo [OddEngine] Apply failed.
  pause
  exit /b 1
)
echo.
echo [OddEngine] v10.37.2 applied. Now run:
echo   npm --prefix ui run build
echo   npm run dev:desktop
echo.
pause
