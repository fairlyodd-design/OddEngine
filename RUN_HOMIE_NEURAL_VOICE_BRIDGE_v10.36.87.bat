@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   Homie Clone Studio + Memory Bridge v10.36.87
echo ========================================
echo.
echo Starts the clone-design bridge on http://127.0.0.1:8776
echo Preview/profile/memory/studio pack lanes work immediately.
echo Neural audio proxy needs HOMIE_NEURAL_TTS_ENDPOINT set.
echo.
set HOMIE_NEURAL_VOICE_PORT=8776
node backend_scaffold\homie-neural-voice-bridge.mjs
pause
