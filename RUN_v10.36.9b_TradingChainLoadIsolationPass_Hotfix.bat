@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.9b_TradingChainLoadIsolationPass_Hotfix.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
