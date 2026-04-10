@echo off
setlocal
cd /d "%~dp0"
echo [Homie Companion] Syncing packages...
call npm install
if errorlevel 1 exit /b 1
echo [Homie Companion] Starting dev mode...
call npm run dev
