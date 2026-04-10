@echo off
cd /d %~dp0\..
node .\scripts\repair-homie-companion-window.mjs
npm --prefix .\ui run build
