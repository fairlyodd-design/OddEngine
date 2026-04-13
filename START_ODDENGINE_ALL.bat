@echo off
setlocal

echo ========================================
echo   ODDENGINE RELEASE SYSTEM ALWAYS ON v10.29.1
echo ========================================

echo Cleaning old node/electron processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM electron.exe /F >nul 2>&1

echo Starting Render Backend (8899)...
start "OddEngine Render Backend" cmd /k "cd /d C:\OddEngine\backend_scaffold && node render-backend.mjs"

timeout /t 2 >nul

echo Starting Music Release Bridge (7010)...
start "OddEngine Release Bridge" cmd /k "cd /d C:\OddEngine\backend_scaffold && node music-provider-bridge.mjs"

timeout /t 4 >nul

echo Starting Desktop (Vite + Electron)...
start "OddEngine Desktop" cmd /k "cd /d C:\OddEngine && npm run dev:desktop"

echo ========================================
echo  Services launched:
echo   - Render backend:  http://127.0.0.1:8899/health
echo   - Release bridge:  http://127.0.0.1:7010/health
echo   - Desktop UI:      http://127.0.0.1:5173
echo ========================================
echo If Release Pack shows red, click Refresh service status in Music Lab.
pause
