@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.62_HomieFullBodyAvatarNotOrbPolishPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.62_HomieFullBodyAvatarNotOrbPolishPass.ps1
pause
