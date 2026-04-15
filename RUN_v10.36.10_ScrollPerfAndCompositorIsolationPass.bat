@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.10_ScrollPerfAndCompositorIsolationPass.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
