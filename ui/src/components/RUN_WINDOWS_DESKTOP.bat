@echo off
setlocal
cd /d %~dp0
echo [OddEngine] Desktop mode
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is not installed or not in PATH.
  echo.
  echo Fix:
  echo   1^) Install Node.js LTS (includes npm^)
  echo   2^) Close and reopen this window
  echo   3^) Run this .bat again
  echo.
  echo Tip: If Node is installed but still fails, restart your PC or re-add Node to PATH.
  echo.
  start "" "https://nodejs.org/en/download/"
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: npm is not available (PATH not set).
  echo.
  echo Fix:
  echo   1^) Reopen your terminal
  echo   2^) Run: where npm
  echo   3^) If it still fails, reinstall Node.js LTS
  echo.
  start "" "https://nodejs.org/en/download/"
  pause
  exit /b 1
)

echo Node: 
node -v
echo npm: 
npm -v
echo where npm:
where npm
echo.
echo Installing dependencies (npm install)...
npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed.
  echo Try running as Administrator or delete node_modules and try again.
  pause
  exit /b 1
)

REM --- Never-again protections ---
REM 1) Auto-wipe Vite cache when UI version changes
set "VER_FILE=.oddengine_last_ui_version.txt"
for /f "delims=" %%i in ('node -p "require('./ui/package.json').version"') do set "CUR_UI_VER=%%i"
set "LAST_UI_VER="
if exist %VER_FILE% (
  set /p LAST_UI_VER=<%VER_FILE%
)
if not "%LAST_UI_VER%"=="%CUR_UI_VER%" (
  echo.
  echo [Guard] UI version changed: %LAST_UI_VER% ^> %CUR_UI_VER%
  echo [Guard] Clearing Vite cache: ui\node_modules\.vite
  if exist "ui\node_modules\.vite" rmdir /s /q "ui\node_modules\.vite"
  echo %CUR_UI_VER%>%VER_FILE%
)

REM 2) Preflight UI build so syntax errors fail fast (no red screen surprise)
echo.
echo [Guard] Preflight: building UI...
npm --prefix ui run build
if errorlevel 1 (
  echo.
  echo ERROR: UI build failed. Fix the error above, then re-run this launcher.
  echo Tip: if you just upgraded versions, try deleting ui\node_modules\.vite
  pause
  exit /b 1
)

echo.
echo Starting app...
npm run dev:desktop
pause
