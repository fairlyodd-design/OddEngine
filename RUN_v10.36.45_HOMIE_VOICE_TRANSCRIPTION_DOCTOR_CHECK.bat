@echo off
setlocal EnableExtensions
cd /d C:\OddEngine

echo [OddEngine] v10.36.45 Homie Voice Transcription Doctor Check
echo.

echo ^> File marker check
if not exist "backend_scaffold\homie-voice-bridge.mjs" (
  echo FAIL missing backend_scaffold\homie-voice-bridge.mjs
  pause
  exit /b 1
)
if not exist "backend_scaffold\homie_voice_transcribe.py" (
  echo FAIL missing backend_scaffold\homie_voice_transcribe.py
  pause
  exit /b 1
)
findstr /C:"v10.36.45" "backend_scaffold\homie-voice-bridge.mjs" >nul || (echo FAIL bridge missing v10.36.45 marker & pause & exit /b 1)
findstr /C:"--doctor" "backend_scaffold\homie_voice_transcribe.py" >nul || (echo FAIL transcriber missing doctor marker & pause & exit /b 1)
echo OK markers present.
echo.

echo ^> Node syntax check
node --check backend_scaffold\homie-voice-bridge.mjs
if not "%ERRORLEVEL%"=="0" (
  echo FAIL node syntax.
  pause
  exit /b 1
)
echo OK node syntax.
echo.

echo ^> Python STT doctor direct check
set "PYCMD="
where python >nul 2>&1
if "%ERRORLEVEL%"=="0" set "PYCMD=python"
if not defined PYCMD (
  where py >nul 2>&1
  if "%ERRORLEVEL%"=="0" set "PYCMD=py -3"
)
if not defined PYCMD (
  echo WARN Python not found. Run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat after installing Python 3.
) else (
  %PYCMD% backend_scaffold\homie_voice_transcribe.py --doctor
)
echo.

echo ^> Live bridge snapshots
powershell -NoProfile -ExecutionPolicy Bypass -Command "function Check($u){ try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $u; Write-Host ('OK   '+$u+' -> '+$r.StatusCode); Write-Host $r.Content } catch { Write-Host ('WARN '+$u+' -> not responding right now') } }; Check 'http://127.0.0.1:8765/health'; Check 'http://127.0.0.1:8765/doctor'; Check 'http://127.0.0.1:8765/last-error'"
echo.
echo [OddEngine] Check complete.
echo If /doctor says packages are missing, run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.45.bat.
echo If /doctor is OK but transcription fails, paste the /last-error output back to Homie.
pause
