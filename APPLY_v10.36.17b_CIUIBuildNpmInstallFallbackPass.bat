@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] Applying v10.36.17b CI UI Build npm install fallback pass
node scripts\apply-ci-ui-build-npm-install-fallback-v10.36.17b.mjs
if errorlevel 1 (
  echo.
  echo [OddEngine] v10.36.17b apply FAILED. Paste the output back to Homie.
  pause
  exit /b 1
)
echo.
echo [OddEngine] v10.36.17b apply complete.
pause
