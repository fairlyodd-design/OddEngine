@echo off
setlocal
set ROOT=%~dp0
powershell -ExecutionPolicy Bypass -File "%ROOT%INSTALL_WINDOWS_MUSIC_RUNTIME.ps1"
if errorlevel 1 (
  echo [OddEngine Music Runtime] Install failed.
  exit /b 1
)
echo [OddEngine Music Runtime] Install complete.
endlocal
