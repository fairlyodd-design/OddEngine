@echo off
setlocal
cd /d %~dp0
echo [OddEngine Fusion] One-click Homie boot
powershell -ExecutionPolicy Bypass -File "%~dp0RUN_WINDOWS_HOMIE_FUSION.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo [OddEngine Fusion] Launch failed with exit code %EXITCODE%.
  pause
)
endlocal
