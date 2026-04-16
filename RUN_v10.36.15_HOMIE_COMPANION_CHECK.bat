@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.15 Homie Companion Life Coach Check

echo.
echo ^> Apply/verify Homie companion patch
node scripts\apply-homie-companion-life-coach-v10.36.15.mjs
if errorlevel 1 goto fail

echo.
echo ^> Runtime import audit
node scripts\system-runtime-import-audit.mjs
if errorlevel 1 goto fail

echo.
echo ^> Typecheck audit lane
npm --prefix ui run typecheck
if errorlevel 1 goto fail

echo.
echo ^> Build UI
npm --prefix ui run build
if errorlevel 1 goto fail

echo.
echo [OddEngine] v10.36.15 Homie Companion Check PASSED.
pause
exit /b 0

:fail
echo.
echo [OddEngine] v10.36.15 Homie Companion Check FAILED. Paste the output back to Homie.
pause
exit /b 1
