@echo off
cd /d "%~dp0"
start "OddEngine Render Backend" cmd /k node render-backend.mjs
start "OddEngine Bark Wrapper" cmd /k node bark-wrapper.mjs
start "OddEngine ComfyUI Wrapper" cmd /k node comfyui-wrapper.mjs
echo [OddEngine] Local media stack launch commands started.
pause
