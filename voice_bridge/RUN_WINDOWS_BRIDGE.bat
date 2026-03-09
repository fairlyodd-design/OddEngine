@echo off
cd /d "%~dp0"
echo [OddEngine Voice Bridge] Installing / verifying dependencies...
py -3 -m pip install -r requirements.txt
if errorlevel 1 (
  echo py launcher failed. Trying python...
  python -m pip install -r requirements.txt
)
echo [OddEngine Voice Bridge] Starting bridge on http://127.0.0.1:8765
py -3 -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765
if errorlevel 1 (
  echo py launcher failed. Trying python...
  python -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765
)
pause
