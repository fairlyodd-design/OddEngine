@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PATCH_v10.36.6_HomiePhoenixRecoveryGuideAndStatusVoicePass.ps1"
echo.
echo Restart OddEngine now.
pause
