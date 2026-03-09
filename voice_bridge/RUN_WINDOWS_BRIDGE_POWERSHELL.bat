@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "py -3 -m pip install -r requirements.txt; if($LASTEXITCODE -ne 0){ python -m pip install -r requirements.txt }; py -3 -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765; if($LASTEXITCODE -ne 0){ python -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765 }"
pause
