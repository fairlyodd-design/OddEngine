@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\APPLY_v10.36.61_Homie3DFullCompanionMicCamPresencePass.ps1"
if errorlevel 1 exit /b 1
powershell -ExecutionPolicy Bypass -File ".\CHECK_v10.36.61_Homie3DFullCompanionMicCamPresencePass.ps1"
