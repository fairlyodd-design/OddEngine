@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.2d_HomeHomiePhoenixDailyTruthPass_FileSafeHotfix.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
