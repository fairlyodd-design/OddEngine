@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.14 Trading Chain Containment Check
node scripts\apply-trading-chain-containment-v10.36.14.mjs
if errorlevel 1 goto :fail

echo.
echo ▶ Runtime import audit
node scripts\system-runtime-import-audit.mjs
if errorlevel 1 goto :fail

echo.
echo ▶ Typecheck audit lane
npm --prefix ui run typecheck
if errorlevel 1 goto :fail

echo.
echo ▶ Build UI
npm --prefix ui run build
if errorlevel 1 goto :fail

echo.
echo [OddEngine] v10.36.14 Trading Chain Check PASSED.
pause
exit /b 0

:fail
echo.
echo [OddEngine] v10.36.14 Trading Chain Check FAILED. Paste this console output back to Homie.
pause
exit /b 1
