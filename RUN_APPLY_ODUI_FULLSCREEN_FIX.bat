@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.37.1 fullscreen rail + cell containment hotfix...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply_v10.37.1_FullscreenRailScrollAndCellContainmentHotfixPass.ps1"
if errorlevel 1 (
  echo.
  echo [OddEngine] Apply failed.
  pause
  exit /b 1
)
echo.
echo [OddEngine] Apply complete. Run: npm --prefix ui run build
echo.
pause
