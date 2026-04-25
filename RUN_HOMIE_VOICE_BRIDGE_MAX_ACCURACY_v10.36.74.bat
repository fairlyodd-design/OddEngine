@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   Homie Voice Bridge MAX ACCURACY
echo ========================================
echo.
echo Uses small.en + beam search. Slower but usually better than base.en.
echo Stop any old 8765 bridge first with Ctrl+C.
echo First run may download/load the model and take longer.
echo.
set HOMIE_WHISPER_MODEL=small.en
set HOMIE_WHISPER_BEAM_SIZE=5
set HOMIE_WHISPER_BEST_OF=5
set HOMIE_WHISPER_VAD=false
set HOMIE_WHISPER_LANGUAGE=en
set HOMIE_WHISPER_TEMPERATURE=0
set HOMIE_WHISPER_NO_SPEECH_THRESHOLD=0.25
set HOMIE_WHISPER_LOG_PROB_THRESHOLD=-1.3
set HOMIE_WHISPER_COMPUTE=int8
set HOMIE_WHISPER_DEVICE=cpu
set HOMIE_VOICE_TRANSCRIBE_TIMEOUT_MS=240000
set HOMIE_VOICE_PORT=8765
node backend_scaffold\homie-voice-bridge.mjs
pause