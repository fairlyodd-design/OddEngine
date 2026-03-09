@echo off
setlocal
cd /d %~dp0
echo [OddEngine] Desktop mode (via PowerShell)
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0RUN_WINDOWS.ps1" -Desktop
pause
