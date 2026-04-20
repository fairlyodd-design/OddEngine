@echo off
setlocal EnableExtensions
cd /d C:\OddEngine\backend_scaffold
echo [OddEngine] Starting Homie Voice Bridge v10.36.45 on http://127.0.0.1:8765/health
echo [OddEngine] Doctor endpoint: http://127.0.0.1:8765/doctor
node homie-voice-bridge.mjs
pause
