@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.17 CI Node24 Actions Check

echo.
echo ^> Apply/verify CI workflow patch
node scripts\apply-ci-node24-actions-v10.36.17.mjs
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
echo [OddEngine] v10.36.17 CI Node24 Actions Check PASSED.
pause
exit /b 0

:fail
echo.
echo [OddEngine] v10.36.17 CI Node24 Actions Check FAILED. Paste the output back to Homie.
pause
exit /b 1
