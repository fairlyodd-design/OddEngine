@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.38.15 Homie Routine Receipts + Legacy Vault Sync...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\apply_v10.38.15_HomieRoutineReceiptsLegacyVaultSyncPass.ps1"
if errorlevel 1 (
  echo.
  echo [OddEngine] Apply failed.
  pause
  exit /b 1
)
echo.
echo [OddEngine] Apply complete. Now run:
echo   npm --prefix ui run typecheck
echo   npm --prefix ui run build
echo   npm run dev:desktop
pause
