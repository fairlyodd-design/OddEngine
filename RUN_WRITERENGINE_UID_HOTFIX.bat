@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0PATCH_writerEngine_uid_fix.ps1"
echo.
pause
