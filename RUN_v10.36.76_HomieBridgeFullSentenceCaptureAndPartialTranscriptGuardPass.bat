@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\APPLY_v10.36.76_HomieBridgeFullSentenceCaptureAndPartialTranscriptGuardPass.ps1"
if errorlevel 1 pause && exit /b 1
powershell -ExecutionPolicy Bypass -File ".\CHECK_v10.36.76_HomieBridgeFullSentenceCaptureAndPartialTranscriptGuardPass.ps1"
pause
