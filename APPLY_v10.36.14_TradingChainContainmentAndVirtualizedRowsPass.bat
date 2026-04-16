@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.36.14 Trading Chain Containment and Virtualized Rows Pass
node scripts\apply-trading-chain-containment-v10.36.14.mjs
if errorlevel 1 (
  echo.
  echo [OddEngine] Apply failed. Make sure this zip was extracted into C:\OddEngine.
  pause
  exit /b 1
)
echo.
echo Next: run RUN_v10.36.14_TRADING_CHAIN_CHECK.bat
pause
