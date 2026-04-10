@echo off
cd /d %~dp0
echo [OddEngine Music Runtime] One-click install + probe + bridge launch...
powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0ONE_CLICK_MUSIC_RUNTIME_AND_BRIDGE.ps1"
pause
