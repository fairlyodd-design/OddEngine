@echo off
setlocal
cd /d "%~dp0"
if not exist "backend_scaffold\homie_voice_debug_audio" mkdir "backend_scaffold\homie_voice_debug_audio"
start "" "backend_scaffold\homie_voice_debug_audio"
