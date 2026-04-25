@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   Homie Clone Editor + Training Bridge v10.36.88
echo ========================================
echo.
echo Starts the clone-design bridge on http://127.0.0.1:8776
echo Profile/family phrase/memory/training workflow lanes work immediately.
echo Neural audio proxy still needs HOMIE_NEURAL_TTS_ENDPOINT.
echo.
set HOMIE_NEURAL_VOICE_PORT=8776
node backend_scaffold\homie-neural-voice-bridge.mjs
pause
