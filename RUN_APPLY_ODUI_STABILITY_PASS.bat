@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.37.0_ODUIStabilityAndCleanupAuditPass...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\apply_v10.37.0_ODUIStabilityAndCleanupAuditPass.ps1" -Root "%CD%"
if errorlevel 1 (
  echo.
  echo [OddEngine] Apply failed.
  pause
  exit /b 1
)
echo.
echo [OddEngine] Pass applied. Now run: npm --prefix ui run build
echo.
pause
