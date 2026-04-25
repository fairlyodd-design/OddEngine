@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   Homie Voice Bridge HIGH ACCURACY
echo ========================================
echo.
echo This uses HOMIE_WHISPER_MODEL=base.en instead of tiny.en.
echo If port 8765 is already in use, close the old bridge window first.
echo First run may download/load the model and take longer.
echo.
set HOMIE_WHISPER_MODEL=base.en
set HOMIE_VOICE_PORT=8765
node backend_scaffold\homie-voice-bridge.mjs
pause