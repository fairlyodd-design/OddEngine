@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.2c_HomeHomiePhoenixDailyTruthPass_PowerShellHomeVarHotfix.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
