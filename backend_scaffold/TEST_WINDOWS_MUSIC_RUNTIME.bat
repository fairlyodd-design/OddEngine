@echo off
setlocal
set ROOT=%~dp0
set PY=%ROOT%\.venv\Scripts\python.exe
if not exist "%PY%" set PY=%ROOT%music_runtime_env\Scripts\python.exe
if not exist "%PY%" (
  echo [OddEngine Music Runtime] Runtime env missing. Expected one of:
  echo   %ROOT%\.venv\Scripts\python.exe
  echo   %ROOT%music_runtime_env\Scripts\python.exe
  pause
  exit /b 1
)
pushd "%ROOT%"
echo [OddEngine Music Runtime] Using Python: %PY%
"%PY%" music_engines\musicgen_model_adapter.py --probe
if errorlevel 1 goto :fail
"%PY%" music_engines\bark_song_adapter.py --probe
if errorlevel 1 goto :fail
echo [OddEngine Music Runtime] Probe completed.
popd
endlocal
pause
exit /b 0
:fail
echo [OddEngine Music Runtime] Probe failed.
popd
endlocal
pause
exit /b 1
