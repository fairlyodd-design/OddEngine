@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\PATCH_v10.36.1b_GodModePhoenixShellAndMissionControlPass_PathHotfix.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
