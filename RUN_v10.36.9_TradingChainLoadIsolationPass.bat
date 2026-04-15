@echo off
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.9_TradingChainLoadIsolationPass.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
