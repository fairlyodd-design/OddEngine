@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0RUN_FAIRLYODD_OS_HOMIE_AND_CLONE_ALL_IN_ONE.ps1"
pause
