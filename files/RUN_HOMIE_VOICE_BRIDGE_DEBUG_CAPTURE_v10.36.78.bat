@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   Homie Voice Bridge DEBUG CAPTURE
echo ========================================
echo.
echo Saves raw mic audio to:
echo backend_scaffold\homie_voice_debug_audio
echo.
echo Stop any old 8765 bridge first with Ctrl+C.
echo Keep this window open while testing Homie.
echo.
set HOMIE_VOICE_KEEP_AUDIO=true
set HOMIE_AUDIO_PREPROCESS=true
set HOMIE_AUDIO_GAIN_DB=10
set HOMIE_WHISPER_MODEL=base.en
set HOMIE_WHISPER_BEAM_SIZE=5
set HOMIE_WHISPER_BEST_OF=5
set HOMIE_WHISPER_VAD=false
set HOMIE_WHISPER_LANGUAGE=en
set HOMIE_WHISPER_TEMPERATURE=0
set HOMIE_VOICE_TRANSCRIBE_TIMEOUT_MS=240000
set HOMIE_VOICE_PORT=8765
node backend_scaffold\homie-voice-bridge.mjs
pause
