@echo off
setlocal
echo ========================================
echo   ODDENGINE MUSIC RELEASE STACK
echo ========================================

taskkill /IM node.exe /F >nul 2>&1

echo Starting Render Backend on 8899...
start "OddEngine Backend" cmd /k "cd /d C:\OddEngine\backend_scaffold && node render-backend.mjs"

timeout /t 2 >nul

echo Starting Music Provider Bridge on 7010...
start "OddEngine Music Bridge" cmd /k "cd /d C:\OddEngine\backend_scaffold && node music-provider-bridge.mjs"

echo Done. Use Inspect latest render source / Download Final Release after a render finishes.
pause
endlocal
