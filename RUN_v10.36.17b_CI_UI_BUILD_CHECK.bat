@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.17b CI UI Build Check
echo.
echo ^> Apply/verify CI UI build workflow
node scripts\apply-ci-ui-build-npm-install-fallback-v10.36.17b.mjs
if errorlevel 1 goto fail
echo.
echo ^> Verify workflow file content
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='.github/workflows/ci-ui-build.yml'; $c=Get-Content $p -Raw; if($c -notmatch 'npm install'){ throw 'npm install missing' }; if($c -match 'npm ci --include=dev'){ throw 'old npm ci command still present' }; if($c -notmatch 'node-version: ''24'''){ throw 'Node 24 missing' }; Write-Host 'Workflow content validation passed.'"
if errorlevel 1 goto fail
echo.
echo ^> Local UI install/build smoke check
npm --prefix ui install
if errorlevel 1 goto fail
npm --prefix ui run typecheck
if errorlevel 1 goto fail
npm --prefix ui run build
if errorlevel 1 goto fail
echo.
echo [OddEngine] v10.36.17b CI UI Build Check PASSED.
pause
exit /b 0
:fail
echo.
echo [OddEngine] v10.36.17b CI UI Build Check FAILED. Paste the output back to Homie.
pause
exit /b 1
