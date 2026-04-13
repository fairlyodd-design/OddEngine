@echo off
cd /d "%~dp0"
echo Running OddEngine runtime + import audit...
call npm run audit:runtime
if errorlevel 1 (
  echo.
  echo Audit found issues.
) else (
  echo.
  echo Audit passed.
)
pause
