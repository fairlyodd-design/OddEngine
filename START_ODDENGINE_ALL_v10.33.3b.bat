@echo off
setlocal

echo ========================================
echo   ODDENGINE TRUE MEDIA LAUNCHER v10.33.3b
echo ========================================

echo Cleaning old node/electron processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM electron.exe /F >nul 2>&1

echo Starting True Render Execution Backend (8899)...
start "OddEngine True Render Execution" cmd /k "cd /d C:\OddEngine\backend_scaffold && node render-execution-server.mjs"

timeout /t 2 >nul

echo Starting Music Release Bridge (7010)...
start "OddEngine Release Bridge" cmd /k "cd /d C:\OddEngine\backend_scaffold && node music-provider-bridge.mjs"

timeout /t 4 >nul

echo Starting Desktop (Vite + Electron)...
start "OddEngine Desktop" cmd /k "cd /d C:\OddEngine && npm run dev:desktop"

echo ========================================
echo  Services launched:
echo   - True render backend:  http://127.0.0.1:8899/health
echo   - Release bridge:       http://127.0.0.1:7010/health
echo   - Desktop UI:           http://127.0.0.1:5173
echo ========================================
echo Writers Lounge v10.33.3b needs render-execution-server.mjs on 8899.
echo If the media button appears dead, check the 8899 window first.
pause
