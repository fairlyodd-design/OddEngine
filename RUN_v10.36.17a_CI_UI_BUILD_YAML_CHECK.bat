@echo off
echo [OddEngine] v10.36.17a CI UI Build YAML Check
echo.
echo ^> Apply/verify workflow YAML fix
node scripts\apply-ci-ui-build-yaml-fix-v10.36.17a.mjs
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
echo [OddEngine] v10.36.17a CI UI Build YAML Check PASSED.
pause
exit /b 0
:fail
echo.
echo [OddEngine] v10.36.17a CI UI Build YAML Check FAILED. Paste the output back to Homie.
pause
exit /b 1
