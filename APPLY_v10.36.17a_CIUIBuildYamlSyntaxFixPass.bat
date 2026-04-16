@echo off
echo [OddEngine] Applying v10.36.17a CI UI Build YAML Syntax Fix Pass
node scripts\apply-ci-ui-build-yaml-fix-v10.36.17a.mjs
if errorlevel 1 (
  echo.
  echo [OddEngine] v10.36.17a apply FAILED. Paste the output back to Homie.
  pause
  exit /b 1
)
echo.
echo [OddEngine] v10.36.17a apply complete.
pause
