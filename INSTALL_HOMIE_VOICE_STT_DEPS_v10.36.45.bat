@echo off
setlocal EnableExtensions

echo [OddEngine] Installing Homie local voice STT dependencies v10.36.45
echo This can take a while the first time. Whisper model download can also take time on first transcription.
echo.
set "PYCMD="
where python >nul 2>&1
if "%ERRORLEVEL%"=="0" set "PYCMD=python"
if not defined PYCMD (
  where py >nul 2>&1
  if "%ERRORLEVEL%"=="0" set "PYCMD=py -3"
)
if not defined PYCMD (
  echo ERROR: Python was not found. Install Python 3, then run this again.
  pause
  exit /b 1
)
%PYCMD% -m pip install --upgrade pip wheel setuptools
%PYCMD% -m pip install --upgrade faster-whisper av ctranslate2 numpy

echo.
echo [OddEngine] Running STT doctor...
%PYCMD% C:\OddEngine\backend_scaffold\homie_voice_transcribe.py --doctor

echo.
echo [OddEngine] STT deps install finished. Restart START_ODDENGINE_ALL_v10.36.45.bat.
pause
