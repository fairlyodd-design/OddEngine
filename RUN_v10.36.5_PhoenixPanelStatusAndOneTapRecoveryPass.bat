@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.5_PhoenixPanelStatusAndOneTapRecoveryPass.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
