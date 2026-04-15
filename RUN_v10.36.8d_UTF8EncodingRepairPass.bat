@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.8d_UTF8EncodingRepairPass.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
