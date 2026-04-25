@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File .\APPLY_HomieBuddyCompanionStageLayoutPolishPass.ps1
if errorlevel 1 pause & exit /b 1
powershell -ExecutionPolicy Bypass -File .\CHECK_HomieBuddyCompanionStageLayoutPolishPass.ps1
pause
