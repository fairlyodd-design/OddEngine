@echo off
cd /d "%~dp0"
start "Homie Companion" cmd /c RUN_HOMIE_COMPANION_DEV_WINDOWS.bat
timeout /t 4 >nul
start "OddEngine Desktop" cmd /c RUN_WINDOWS_DESKTOP.bat
