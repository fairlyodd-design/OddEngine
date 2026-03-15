@echo off
cd /d %~dp0
node scripts\audit\generate-baseline-lock.mjs
pause
