@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ODD_ROOT=C:\OddEngine"
set "BACKEND_DIR=%ODD_ROOT%\backend_scaffold"
set "VOICE_PORT=8765"
set "RENDER_PORT=8899"
set "MUSIC_PORT=7010"

rem v10.36.44b literal health marker for checks: http://127.0.0.1:8765/health

cls
echo ========================================
echo   ODDENGINE FAMILY VOICE LAUNCHER v10.36.44b
echo ========================================
echo.
echo Starts render, music, Homie voice bridge, then Electron/Vite.
echo Homie voice bridge health: http://127.0.0.1:%VOICE_PORT%/health
echo.

echo Cleaning old node/electron processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM electron.exe /F >nul 2>&1

echo.
echo Starting True Render Execution Backend (%RENDER_PORT%)...
if exist "%BACKEND_DIR%\render-execution-server.mjs" (
  start "OddEngine True Render Execution" cmd /k "cd /d %BACKEND_DIR% && node render-execution-server.mjs"
) else (
  echo   WARN: render-execution-server.mjs not found in %BACKEND_DIR%
)

timeout /t 2 >nul

echo.
echo Starting Music Release Bridge (%MUSIC_PORT%)...
if exist "%BACKEND_DIR%\music-provider-bridge.mjs" (
  start "OddEngine Release Bridge" cmd /k "cd /d %BACKEND_DIR% && node music-provider-bridge.mjs"
) else (
  echo   WARN: music-provider-bridge.mjs not found in %BACKEND_DIR%
)

timeout /t 2 >nul

echo.
echo Starting Homie Voice Bridge (%VOICE_PORT%)...
call :StartHomieVoiceBridge

timeout /t 4 >nul

echo.
echo Starting Desktop (Vite + Electron)...
start "OddEngine Desktop" cmd /k "cd /d %ODD_ROOT% && npm run dev:desktop"

echo.
echo ========================================
echo  Services launched / checked:
echo   - True render backend:  http://127.0.0.1:%RENDER_PORT%/health
echo   - Release bridge:       http://127.0.0.1:%MUSIC_PORT%/health
echo   - Homie voice bridge:   http://127.0.0.1:%VOICE_PORT%/health
echo   - Desktop UI:           http://127.0.0.1:5173
echo ========================================
echo.
echo If Talk by mic still has trouble:
echo   1. Check the Homie Voice Bridge window.
echo   2. In Homie, click Voice details then Probe bridge.
echo   3. If /health is green but /transcribe fails, run INSTALL_HOMIE_VOICE_STT_DEPS_v10.36.44b.bat.
echo.
pause
exit /b 0

:StartHomieVoiceBridge
call :CheckHealth "http://127.0.0.1:%VOICE_PORT%/health"
if "%ERRORLEVEL%"=="0" (
  echo   OK: Homie voice bridge already responds on %VOICE_PORT%.
  exit /b 0
)

if exist "%BACKEND_DIR%\homie-voice-bridge.mjs" (
  echo   Starting OddEngine Homie voice bridge: %BACKEND_DIR%\homie-voice-bridge.mjs
  start "Homie Voice Bridge %VOICE_PORT%" cmd /k "cd /d %BACKEND_DIR% && node homie-voice-bridge.mjs"
  exit /b 0
)

echo   WARN: No Homie voice bridge script found at %BACKEND_DIR%\homie-voice-bridge.mjs
exit /b 1

:CheckHealth
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%~1'; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%
