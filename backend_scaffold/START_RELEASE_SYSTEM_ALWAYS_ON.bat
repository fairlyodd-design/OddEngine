@echo off
setlocal

echo ========================================
echo   ODDENGINE BACKEND RELEASE STACK v10.29.1
echo ========================================

echo Cleaning old node processes...
taskkill /IM node.exe /F >nul 2>&1

echo Starting Render Backend (8899)...
start "OddEngine Render Backend" cmd /k "cd /d C:\OddEngine\backend_scaffold && node render-backend.mjs"

timeout /t 2 >nul

echo Starting Music Release Bridge (7010)...
start "OddEngine Release Bridge" cmd /k "cd /d C:\OddEngine\backend_scaffold && node music-provider-bridge.mjs"

echo Health endpoints:
echo   http://127.0.0.1:8899/health
echo   http://127.0.0.1:7010/health
pause
