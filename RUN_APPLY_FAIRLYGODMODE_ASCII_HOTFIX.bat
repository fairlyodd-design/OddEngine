@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.37.8c FairlyGodMode ASCII sanitizer hotfix...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\apply_v10.37.8c_FairlyGodModeAsciiSanitizerHotfixPass.ps1"
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
