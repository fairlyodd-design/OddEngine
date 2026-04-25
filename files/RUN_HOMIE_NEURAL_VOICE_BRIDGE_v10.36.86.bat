@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   Homie Neural Voice Bridge v10.36.86
echo ========================================
echo.
echo This starts the clone-design bridge on http://127.0.0.1:8776
echo Preview mode works immediately.
echo Neural audio proxy needs HOMIE_NEURAL_TTS_ENDPOINT set.
echo.
set HOMIE_NEURAL_VOICE_PORT=8776
node backend_scaffold\homie-neural-voice-bridge.mjs
pause
