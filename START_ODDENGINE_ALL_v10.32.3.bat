@echo off
setlocal

echo ========================================
echo   ODDENGINE FULL SYSTEM STARTER v10.32.3
echo ========================================

echo Cleaning old node/electron processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM electron.exe /F >nul 2>&1

echo Starting Render Execution Backend (8899)...
start "OddEngine Render Execution Backend" cmd /k "cd /d C:\OddEngine\backend_scaffold && node render-execution-server.mjs"

timeout /t 2 >nul

echo Starting Publishing Connector Runner (8900)...
start "OddEngine Publishing Runner" cmd /k "cd /d C:\OddEngine\backend_scaffold && node publishing-connector-server.mjs"

timeout /t 2 >nul

echo Starting Music Release Bridge (7010)...
start "OddEngine Release Bridge" cmd /k "cd /d C:\OddEngine\backend_scaffold && node music-provider-bridge.mjs"

timeout /t 4 >nul

echo Starting Desktop (Vite + Electron)...
start "OddEngine Desktop" cmd /k "cd /d C:\OddEngine && npm run dev:desktop"

echo ========================================
echo  Services launched:
echo   - Render execution:   http://127.0.0.1:8899/health
echo   - Publishing runner:  http://127.0.0.1:8900/health
echo   - Release bridge:     http://127.0.0.1:7010/health
echo   - Desktop UI:         http://127.0.0.1:5173
echo ========================================
echo Writers Lounge should use:
echo   - Render backend URL:       http://127.0.0.1:8899
echo   - Publishing connector URL: http://127.0.0.1:8900
echo ========================================
echo If a service shows red, check the matching command window for errors.
pause
