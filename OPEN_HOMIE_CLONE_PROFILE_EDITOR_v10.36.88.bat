@echo off
setlocal
cd /d "%~dp0"
if not exist "backend_scaffold\homie_clone_profile_editor.v10.36.88.html" (
  echo Missing editor HTML.
  pause
  exit /b 1
)
start "" "backend_scaffold\homie_clone_profile_editor.v10.36.88.html"
