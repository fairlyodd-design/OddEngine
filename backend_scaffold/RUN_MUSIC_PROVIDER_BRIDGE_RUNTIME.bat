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
set MUSIC_PYTHON=%PY%
echo [OddEngine Music Runtime] Using Python: %PY%
echo [OddEngine Music Runtime] Starting bridge on http://127.0.0.1:7010 ...
node music-provider-bridge.mjs
set ERR=%ERRORLEVEL%
popd
endlocal
pause
exit /b %ERR%
