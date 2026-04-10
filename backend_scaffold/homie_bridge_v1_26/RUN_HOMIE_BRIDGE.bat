@echo off
setlocal
cd /d %~dp0

echo [Homie v1.26] Starting local voice bridge on http://127.0.0.1:8765

afterglow:
python -m uvicorn homie_voice_bridge_v1_26:app --host 127.0.0.1 --port 8765
if errorlevel 1 (
  echo.
  echo [Homie v1.26] Bridge failed to start.
  echo Install requirements first:
  echo   pip install -r requirements.txt
  echo.
  pause
)
endlocal
