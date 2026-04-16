@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.36.14g Trading Chain Containment Compile Restore Pass
node scripts\apply-trading-chain-containment-compile-restore-v10.36.14g.mjs
if errorlevel 1 (
  echo.
  echo [OddEngine] v10.36.14g apply FAILED. Paste the output back to Homie.
  pause
  exit /b 1
)
echo.
echo [OddEngine] v10.36.14g apply complete.
pause
