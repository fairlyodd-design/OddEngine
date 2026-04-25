@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.61b_Homie3DCompanionApplyAndTypecheckHotfixPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.61b_Homie3DCompanionApplyAndTypecheckHotfixPass.ps1
pause
