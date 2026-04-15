@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.2b_HomeHomiePhoenixDailyTruthPass_HereStringHotfix.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
