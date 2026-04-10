@echo off
echo ========================================
echo   ODDENGINE FULL SYSTEM BOOT v10.28
echo ========================================

taskkill /IM node.exe /F >nul 2>&1

echo Starting Backend...
start "OddEngine Backend" cmd /k "cd /d C:\OddEngine\backend_scaffold && node render-backend.mjs"

timeout /t 3 >nul

echo Starting Desktop (UI + Electron)...
start "OddEngine Desktop" cmd /k "cd /d C:\OddEngine && npm run dev:desktop"

echo Boot commands sent.
pause
