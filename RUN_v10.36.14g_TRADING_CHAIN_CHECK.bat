@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.14g Trading Chain Containment Check

echo.
echo ^> Apply/verify compile restore
node scripts\apply-trading-chain-containment-compile-restore-v10.36.14g.mjs
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
echo [OddEngine] v10.36.14g Trading Chain Containment Check PASSED.
pause
exit /b 0

:fail
echo.
echo [OddEngine] v10.36.14g Trading Chain Check FAILED. Paste the output back to Homie.
pause
exit /b 1
