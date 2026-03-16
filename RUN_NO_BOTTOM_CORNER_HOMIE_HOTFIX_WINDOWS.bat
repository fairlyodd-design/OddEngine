@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\hotfix\NoBottomCornerHomieHotfix.ps1"
echo.
echo Press any key to continue . . .
pause >nul
