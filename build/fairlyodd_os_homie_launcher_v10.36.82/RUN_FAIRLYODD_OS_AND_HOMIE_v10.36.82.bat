@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ODD_ROOT=C:\OddEngine"
set "BACKEND_DIR=%ODD_ROOT%\backend_scaffold"
set "VOICE_PORT=8765"
set "RENDER_PORT=8899"
set "MUSIC_PORT=7010"

cls
echo ========================================
echo   FAIRLYODD OS + HOMIE LAUNCHER v10.36.82
echo ========================================
echo.
echo Starts render, music, Homie voice bridge, then desktop UI.
echo Keeps launcher logic simple and stable.
echo.

if not exist "%ODD_ROOT%" (
  echo ERROR: Expected OddEngine at %ODD_ROOT%
  pause
  exit /b 1
)

echo Cleaning old node/electron processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM electron.exe /F >nul 2>&1

echo.
echo Starting render backend...
if exist "%BACKEND_DIR%\render-execution-server.mjs" (
  start "FairlyOdd Render Backend" cmd /k "cd /d %BACKEND_DIR% && node render-execution-server.mjs"
) else (
  echo   WARN: render-execution-server.mjs not found
)

timeout /t 2 >nul

echo.
echo Starting music bridge...
if exist "%BACKEND_DIR%\music-provider-bridge.mjs" (
  start "FairlyOdd Music Bridge" cmd /k "cd /d %BACKEND_DIR% && node music-provider-bridge.mjs"
) else (
  echo   WARN: music-provider-bridge.mjs not found
)

timeout /t 2 >nul

echo.
echo Starting Homie voice bridge...
if exist "%ODD_ROOT%\RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat" (
  start "Homie Voice Bridge" cmd /k "cd /d %ODD_ROOT% && call RUN_HOMIE_VOICE_BRIDGE_AUDIO_CLEANUP_v10.36.75.bat"
) else if exist "%ODD_ROOT%\RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat" (
  start "Homie Voice Bridge" cmd /k "cd /d %ODD_ROOT% && call RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat"
) else (
  echo   WARN: No Homie voice bridge launcher found
)

timeout /t 4 >nul

echo.
echo Starting desktop UI...
if exist "%ODD_ROOT%\package.json" (
  start "FairlyOdd Desktop" cmd /k "cd /d %ODD_ROOT% && npm run dev:desktop"
) else (
  echo   WARN: package.json not found at %ODD_ROOT%
)

timeout /t 5 >nul
start "" http://127.0.0.1:5173

echo.
echo ========================================
echo Render: http://127.0.0.1:%RENDER_PORT%/health
echo Music:  http://127.0.0.1:%MUSIC_PORT%/health
echo Voice:  http://127.0.0.1:%VOICE_PORT%/health
echo UI:     http://127.0.0.1:5173
echo ========================================
echo.
pause
exit /b 0
