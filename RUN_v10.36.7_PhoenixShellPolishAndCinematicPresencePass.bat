@echo off
setlocal
PowerShell -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.7_PhoenixShellPolishAndCinematicPresencePass.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
