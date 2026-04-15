@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.8c3_HomeDuplicateImportHotfix.ps1"
echo.
echo Rebuild or restart OddEngine now.
pause
