@echo off
setlocal
cd /d %~dp0
echo [OddEngine] Web mode (via PowerShell)
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0RUN_WINDOWS.ps1" -Web
pause
