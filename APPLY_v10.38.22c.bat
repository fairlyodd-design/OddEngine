@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\APPLY_v10.38.22c_HomieAvatarStageSourceTraceAndHardReplace.ps1" -RepoRoot "%CD%"
if errorlevel 1 (
  echo.
  echo [v10.38.22c] Patch failed. If this folder is not C:\OddEngine, run:
  echo powershell -NoProfile -ExecutionPolicy Bypass -File scripts\APPLY_v10.38.22c_HomieAvatarStageSourceTraceAndHardReplace.ps1 -RepoRoot C:\OddEngine
  pause
  exit /b 1
)
pause
